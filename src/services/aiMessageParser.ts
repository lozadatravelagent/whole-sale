import { supabase } from '@/integrations/supabase/client';
import { createDebugTimer, logTimingStep, nowMs } from '@/utils/debugTiming';
import type { ParseMessageKnowledge } from '@/features/chat/types/knowledge';
import {
    getNormalizedFlightSegments,
    normalizeFlightRequest,
    normalizeParsedFlightRequest,
    type FlightTripType
} from '@/services/flightSegments';
import {
    normalizeDestinationListToCapitals,
    normalizeDestinationToCapitalIfCountry,
    findCountryInMessageForCapital,
} from '@/services/countryCapitalResolver';

export interface HotelStaySegment {
    id?: string;
    city?: string;
    hotelName?: string;
    hotelNames?: string[];
    checkinDate?: string;
    checkoutDate?: string;
    adults?: number;
    adultsExplicit?: boolean;
    children?: number;
    childrenAges?: number[];
    infants?: number;
    roomType?: 'single' | 'double' | 'triple';
    hotelChains?: string[];
    mealPlan?: 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only';
    freeCancellation?: boolean;
    roomView?: 'mountain_view' | 'beach_view' | 'city_view' | 'garden_view';
    roomCount?: number;
}

export interface HotelRequest {
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
    segments?: HotelStaySegment[];
}

export type PlannerEditIntentAction =
    | 'create'
    | 'restart_plan'
    | 'replace_destination'
    | 'add_destination'
    | 'remove_destination'
    | 'reorder_destinations'
    | 'merge_destinations'
    | 'split_destination'
    | 'change_dates'
    | 'adjust_duration'
    | 'rebalance_duration'
    | 'change_budget'
    | 'change_pace'
    | 'change_travelers'
    | 'change_interests'
    | 'change_hotels'
    | 'change_transport'
    | 'change_activities'
    | 'change_restaurants'
    | 'change_constraints'
    | 'regenerate_day'
    | 'regenerate_segment'
    | 'upgrade_hotels'
    | 'downgrade_hotels'
    | 'custom_instruction';

export type PlannerEditIntentScope =
    | 'plan'
    | 'destination'
    | 'segment'
    | 'day'
    | 'dates'
    | 'duration'
    | 'budget'
    | 'pace'
    | 'travelers'
    | 'interests'
    | 'hotels'
    | 'transport'
    | 'activities'
    | 'restaurants'
    | 'constraints';

export interface PlannerEditIntent {
    action?: PlannerEditIntentAction;
    scope?: PlannerEditIntentScope;
    targetSegmentId?: string;
    targetDayId?: string;
    targetCity?: string;
    target?: string | Record<string, unknown>;
    replacement?: string | Record<string, unknown>;
    replacementDestination?: string;
    value?: string | number | boolean | string[] | Record<string, unknown>;
    direction?: 'more' | 'less' | 'increase' | 'decrease' | 'add' | 'remove' | 'replace' | 'avoid' | 'prefer' | 'faster' | 'slower';
    daysDelta?: number;
    desiredDays?: number;
    rawInstruction?: string;
    confidence?: number;
}

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
    hotels?: HotelRequest;
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
        days?: number; // Cantidad de días del itinerario
        startDate?: string;
        endDate?: string;
        isFlexibleDates?: boolean;
        flexibleMonth?: string;
        flexibleYear?: number;
        dateSelectionSource?: 'chat_modal_exact' | 'chat_modal_flexible' | 'message';
        budgetLevel?: 'low' | 'mid' | 'high' | 'luxury';
        budgetAmount?: number;
        interests?: string[];
        travelStyle?: string[];
        pace?: 'relaxed' | 'balanced' | 'fast';
        hotelCategory?: string;
        travelers?: {
            adults?: number;
            children?: number;
            infants?: number;
        };
        constraints?: string[];
        currentPlanSummary?: string;
        editIntent?: PlannerEditIntent;
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

function normalizeLocationsToCountryCapitals(parsed: ParsedTravelRequest): ParsedTravelRequest {
    const nextParsed: ParsedTravelRequest = { ...parsed };

    // Itinerary destinations are NOT normalized to capitals.
    // The planner has its own regional expansion (expandDestinationsIfRegional)
    // that handles "Italia" → multi-city routes. Normalizing here would
    // collapse "Italia" to "Rome" before expansion can run.

    if (nextParsed.hotels) {
        nextParsed.hotels = {
            ...nextParsed.hotels,
            ...(nextParsed.hotels.city
                ? { city: normalizeDestinationToCapitalIfCountry(nextParsed.hotels.city) }
                : {}),
            ...(Array.isArray(nextParsed.hotels.segments)
                ? {
                    segments: nextParsed.hotels.segments.map((segment) => ({
                        ...segment,
                        ...(segment.city
                            ? { city: normalizeDestinationToCapitalIfCountry(segment.city) }
                            : {}),
                    })),
                }
                : {}),
        };
    }

    if (nextParsed.flights) {
        nextParsed.flights = {
            ...nextParsed.flights,
            ...(nextParsed.flights.origin
                ? { origin: normalizeDestinationToCapitalIfCountry(nextParsed.flights.origin) }
                : {}),
            ...(nextParsed.flights.destination
                ? { destination: normalizeDestinationToCapitalIfCountry(nextParsed.flights.destination) }
                : {}),
            ...(Array.isArray(nextParsed.flights.segments)
                ? {
                    segments: nextParsed.flights.segments.map((segment) => ({
                        ...segment,
                        ...(segment.origin
                            ? { origin: normalizeDestinationToCapitalIfCountry(segment.origin) }
                            : {}),
                        ...(segment.destination
                            ? { destination: normalizeDestinationToCapitalIfCountry(segment.destination) }
                            : {}),
                    })),
                }
                : {}),
        };
    }

    if (nextParsed.packages?.destination) {
        nextParsed.packages = {
            ...nextParsed.packages,
            destination: normalizeDestinationToCapitalIfCountry(nextParsed.packages.destination),
        };
    }

    if (nextParsed.services?.city) {
        nextParsed.services = {
            ...nextParsed.services,
            city: normalizeDestinationToCapitalIfCountry(nextParsed.services.city),
        };
    }

    return nextParsed;
}

/**
 * Deterministic guardrail: if the parser returned a capital as an itinerary
 * destination but the user's message mentions the country, restore the
 * country name so planner country-route expansion can run.
 * Only applies to itinerary — flights/hotels correctly use capitals.
 */
function restoreCountryDestinationsForItinerary(
    parsed: ParsedTravelRequest,
    originalMessage: string,
): ParsedTravelRequest {
    if (parsed.requestType !== 'itinerary' || !parsed.itinerary?.destinations?.length) {
        return parsed;
    }

    const normalizedMsg = originalMessage
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[.,()]/g, ' ')
        .replace(/\s+/g, ' ');

    let changed = false;
    const corrected = parsed.itinerary.destinations.map(dest => {
        const country = findCountryInMessageForCapital(dest, normalizedMsg);
        if (country) {
            changed = true;
            return country;
        }
        return dest;
    });

    if (!changed) return parsed;
    return {
        ...parsed,
        itinerary: { ...parsed.itinerary, destinations: corrected },
    };
}

const HOTEL_MONTHS: Record<string, string> = {
    'enero': '01',
    'febrero': '02',
    'marzo': '03',
    'abril': '04',
    'mayo': '05',
    'junio': '06',
    'julio': '07',
    'agosto': '08',
    'septiembre': '09',
    'setiembre': '09',
    'octubre': '10',
    'noviembre': '11',
    'diciembre': '12'
};

const ITINERARY_MONTHS: Record<string, string> = {
    ...HOTEL_MONTHS,
    'january': '01',
    'february': '02',
    'march': '03',
    'april': '04',
    'may': '05',
    'june': '06',
    'july': '07',
    'august': '08',
    'september': '09',
    'october': '10',
    'november': '11',
    'december': '12'
};

function normalizeHotelText(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

function toIsoDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function addDaysToIsoDate(dateString: string, daysToAdd: number): string {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    date.setDate(date.getDate() + daysToAdd);
    return toIsoDate(date);
}

function shiftIsoDateToYear(dateString: string, targetYear: number): string {
    const [_, month = '01', day = '01'] = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
    return `${targetYear}-${month}-${day}`;
}

function extractItineraryMonthHint(message: string): { monthNum: string; explicitYear?: number } | null {
    const normalized = normalizeHotelText(message);
    const monthPattern = Object.keys(ITINERARY_MONTHS)
        .sort((a, b) => b.length - a.length)
        .join('|');

    const monthMatch = normalized.match(new RegExp(`\\b(${monthPattern})\\b(?:\\s*(?:de)?\\s*(20\\d{2}))?`, 'i'));
    if (!monthMatch) return null;

    const monthKey = monthMatch[1].toLowerCase();
    const monthNum = ITINERARY_MONTHS[monthKey];
    if (!monthNum) return null;

    return {
        monthNum,
        explicitYear: monthMatch[2] ? parseInt(monthMatch[2], 10) : undefined
    };
}

function getTargetYearForMonthHint(
    monthHint: { monthNum: string; explicitYear?: number },
    referenceDate: Date
): number {
    const requestedMonth = parseInt(monthHint.monthNum, 10);
    return monthHint.explicitYear
        ?? (requestedMonth < (referenceDate.getMonth() + 1)
            ? referenceDate.getFullYear() + 1
            : referenceDate.getFullYear());
}

function getMonthNameFromNumber(monthNum: string): string {
    const monthNames: Record<string, string> = {
        '01': 'enero',
        '02': 'febrero',
        '03': 'marzo',
        '04': 'abril',
        '05': 'mayo',
        '06': 'junio',
        '07': 'julio',
        '08': 'agosto',
        '09': 'septiembre',
        '10': 'octubre',
        '11': 'noviembre',
        '12': 'diciembre'
    };

    return monthNames[monthNum] || monthNum;
}

function formatSpanishDate(dateString: string): string {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;

    return `${date.getDate()} de ${getMonthNameFromNumber(String(date.getMonth() + 1).padStart(2, '0'))} de ${date.getFullYear()}`;
}

function getLastDayOfMonth(year: number, monthNum: string): number {
    return new Date(year, parseInt(monthNum, 10), 0).getDate();
}

function buildSuggestedItineraryDateRanges(
    itinerary: ParsedTravelRequest['itinerary'] | undefined,
    message: string,
    referenceDate: Date = new Date()
): Array<{ startDate: string; endDate: string; label: string }> {
    const monthHint = extractItineraryMonthHint(message);
    if (!monthHint) return [];

    const normalizedReference = new Date(referenceDate);
    normalizedReference.setHours(0, 0, 0, 0);

    const targetYear = getTargetYearForMonthHint(monthHint, normalizedReference);
    const totalDays = itinerary?.days && itinerary.days > 0 ? itinerary.days : 7;
    const lastDayOfMonth = getLastDayOfMonth(targetYear, monthHint.monthNum);
    const maxStartDay = lastDayOfMonth - totalDays + 1;

    if (maxStartDay < 1) return [];

    const candidateStartDays = Array.from(new Set([
        1,
        Math.max(1, Math.min(8, maxStartDay)),
        Math.max(1, Math.min(15, maxStartDay))
    ])).sort((a, b) => a - b);

    return candidateStartDays
        .map((startDay) => {
            const startDate = `${targetYear}-${monthHint.monthNum}-${String(startDay).padStart(2, '0')}`;
            const endDate = addDaysToIsoDate(startDate, Math.max(0, totalDays - 1));
            const endMonth = endDate.slice(5, 7);
            const endYear = parseInt(endDate.slice(0, 4), 10);

            if (endMonth !== monthHint.monthNum || endYear !== targetYear) {
                return null;
            }

            return {
                startDate,
                endDate,
                label: `Del ${formatSpanishDate(startDate)} al ${formatSpanishDate(endDate)}`
            };
        })
        .filter((option): option is { startDate: string; endDate: string; label: string } => Boolean(option));
}

export function hasExactItineraryDateRange(itinerary?: ParsedTravelRequest['itinerary']): boolean {
    return Boolean(itinerary?.startDate && itinerary?.endDate);
}

export function hasFlexibleItineraryDateSelection(itinerary?: ParsedTravelRequest['itinerary']): boolean {
    return Boolean(
        itinerary?.isFlexibleDates &&
        itinerary?.flexibleMonth &&
        itinerary?.flexibleYear
    );
}

export function hasUsableItineraryDates(itinerary?: ParsedTravelRequest['itinerary']): boolean {
    return hasExactItineraryDateRange(itinerary) || hasFlexibleItineraryDateSelection(itinerary);
}

export function resolveItineraryDateRange(
    itinerary: ParsedTravelRequest['itinerary'] | undefined,
    message: string,
    referenceDate: Date = new Date()
): Pick<NonNullable<ParsedTravelRequest['itinerary']>, 'startDate' | 'endDate'> {
    if (!itinerary) return {};

    const normalizedReference = new Date(referenceDate);
    normalizedReference.setHours(0, 0, 0, 0);

    const explicitYearInMessage = /\b20\d{2}\b/.test(message);

    if (!explicitYearInMessage && itinerary.startDate && itinerary.endDate) {
        const startDate = new Date(`${itinerary.startDate}T00:00:00`);
        const endDate = new Date(`${itinerary.endDate}T00:00:00`);

        if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate < normalizedReference) {
            let shiftedStart = itinerary.startDate;
            let shiftedEnd = itinerary.endDate;

            while (new Date(`${shiftedEnd}T00:00:00`) < normalizedReference) {
                const nextYear = parseInt(shiftedStart.slice(0, 4), 10) + 1;
                shiftedStart = shiftIsoDateToYear(shiftedStart, nextYear);
                shiftedEnd = shiftIsoDateToYear(shiftedEnd, nextYear);
            }

            return {
                startDate: shiftedStart,
                endDate: shiftedEnd
            };
        }
    }

    return {};
}

function buildHotelSegmentId(segment: Partial<HotelStaySegment>, index: number): string {
    const city = normalizeHotelText(segment.city || 'tramo')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const checkin = segment.checkinDate || 'sin-fecha';
    const checkout = segment.checkoutDate || 'sin-fecha';
    return `hotel-segment-${index + 1}-${city || 'tramo'}-${checkin}-${checkout}`;
}

function stripTrailingPunctuation(value: string): string {
    return value.replace(/[,:;.!]+$/g, '').trim();
}

function detectRoomTypeFromText(message: string): HotelStaySegment['roomType'] | undefined {
    const normalized = normalizeHotelText(message);

    if (/\b(triple)\b/.test(normalized)) return 'triple';
    if (/\b(double|doble|twin)\b/.test(normalized)) return 'double';
    if (/\b(single|simple|individual)\b/.test(normalized)) return 'single';

    return undefined;
}

function detectMealPlanFromText(message: string): HotelStaySegment['mealPlan'] | undefined {
    const normalized = normalizeHotelText(message);

    if (normalized.includes('all inclusive') || normalized.includes('todo incluido')) {
        return 'all_inclusive';
    }
    if (normalized.includes('media pension') || normalized.includes('half board')) {
        return 'half_board';
    }
    if (normalized.includes('room only') || normalized.includes('solo habitacion') || normalized.includes('solo alojamiento')) {
        return 'room_only';
    }
    if (normalized.includes('desayuno') || normalized.includes('breakfast')) {
        return 'breakfast';
    }

    return undefined;
}

function detectAdultsFromText(message: string): { adults?: number; adultsExplicit?: boolean } {
    const normalized = normalizeHotelText(message);
    const explicitCount = normalized.match(/(\d+)\s*(adultos?|personas?)/i);
    const numberWords: Record<string, number> = {
        'un': 1,
        'una': 1,
        'uno': 1,
        'dos': 2,
        'tres': 3,
        'cuatro': 4,
        'cinco': 5,
        'seis': 6
    };

    if (explicitCount) {
        return {
            adults: Math.max(1, parseInt(explicitCount[1], 10)),
            adultsExplicit: true
        };
    }

    const explicitWords = normalized.match(/\b(un|una|uno|dos|tres|cuatro|cinco|seis)\s+(adultos?|personas?)\b/i);
    if (explicitWords) {
        return {
            adults: numberWords[explicitWords[1].toLowerCase()],
            adultsExplicit: true
        };
    }

    if (/\b(una persona|un adulto|1 adulto)\b/i.test(normalized)) {
        return {
            adults: 1,
            adultsExplicit: true
        };
    }

    return {};
}

function detectHotelCityFromText(message: string): string | undefined {
    const cityPatterns = [
        /\ben\s+([a-zA-Záéíóúñü.' -]+?)(?=\s+(?:desde|para|habitacion|habitación|cadena|all inclusive|todo incluido|con desayuno|desayuno|media pension|media pensión|room only|solo habitacion|solo habitación|del?\s+\d{1,2}\b|$))/i,
        /^([a-zA-Záéíóúñü.' -]+?)(?=\s+(?:desde|para|habitacion|habitación|cadena|all inclusive|todo incluido|con desayuno|desayuno|media pension|media pensión|room only|solo habitacion|solo habitación|del?\s+\d{1,2}\b|$))/i
    ];

    for (const pattern of cityPatterns) {
        const match = message.match(pattern);
        if (match?.[1]) {
            const cleaned = stripTrailingPunctuation(
                match[1]
                    .replace(/^(?:quiero|necesito|busco|un|una|hotel|hoteles|alojamiento|hospedaje|en)\s+/i, '')
                    .trim()
            );

            if (cleaned) {
                return cleaned;
            }
        }
    }

    return undefined;
}

function resolveHotelDate(
    day: string,
    monthName?: string,
    referenceDate?: string,
    previousDate?: string
): string | undefined {
    const monthFromReference = referenceDate ? referenceDate.slice(5, 7) : undefined;
    const monthNum = monthName ? HOTEL_MONTHS[normalizeHotelText(monthName)] : monthFromReference;
    if (!monthNum) return undefined;

    const baseDate = previousDate ? new Date(previousDate) : referenceDate ? new Date(referenceDate) : new Date();
    let year = baseDate.getFullYear();
    const requestedMonth = parseInt(monthNum, 10);
    const baseMonth = baseDate.getMonth() + 1;

    if (requestedMonth < baseMonth || (requestedMonth === baseMonth && parseInt(day, 10) < baseDate.getDate())) {
        year += 1;
    }

    return `${year}-${monthNum}-${day.padStart(2, '0')}`;
}

function parseHotelDateRangeFromText(
    message: string,
    previousSegment?: HotelStaySegment
): Pick<HotelStaySegment, 'checkinDate' | 'checkoutDate'> {
    const rangePattern = /(?:desde\s+el?|desde|del?)\s*(\d{1,2})(?:\s+de\s+([a-záéíóú]+))?\s+al\s*(\d{1,2})(?:\s+de\s+([a-záéíóú]+))?/i;
    const shortPattern = /(\d{1,2})\s+al\s+(\d{1,2})(?:\s+de\s+([a-záéíóú]+))?/i;
    const match = message.match(rangePattern) || message.match(shortPattern);

    if (!match) {
        return {};
    }

    const isShortPattern = message.match(rangePattern) === null;
    const startDay = match[1];
    const startMonth = isShortPattern ? match[3] : match[2];
    const endDay = isShortPattern ? match[2] : match[3];
    const endMonth = isShortPattern ? match[3] : match[4];
    const referenceDate = previousSegment?.checkoutDate || previousSegment?.checkinDate;

    const resolvedStart = resolveHotelDate(
        startDay,
        startMonth || endMonth,
        referenceDate,
        previousSegment?.checkinDate
    );
    const resolvedEnd = resolveHotelDate(
        endDay,
        endMonth || startMonth,
        resolvedStart || referenceDate,
        previousSegment?.checkoutDate || resolvedStart
    );

    return {
        checkinDate: resolvedStart,
        checkoutDate: resolvedEnd
    };
}

function splitHotelMessageIntoChunks(message: string): string[] {
    const normalized = message.replace(/\s+/g, ' ').trim();

    // Strip flight portion from the message before splitting hotel chunks.
    // This prevents the date regex from matching flight dates instead of hotel dates.
    // Pattern: everything before "tambien/también quiero un/el hotel" or "tambien/también hotel"
    const hotelOnly = normalized.replace(
        /^.*?(?=(?:tambien|también|tambi[eé]n)\s+(?:quiero\s+)?(?:un\s+|el\s+)?hotel)/i,
        ''
    );
    const textToSplit = hotelOnly.length > 0 && hotelOnly !== normalized ? hotelOnly : normalized;

    const withBreaks = textToSplit.replace(/\s+(?:y|luego|despues|después|ademas|además)\s+en\s+/gi, ' ||| en ');
    return withBreaks
        .split('|||')
        .map((chunk) => chunk.trim())
        .filter(Boolean);
}

function buildHotelSegmentFromRequest(hotels?: Partial<HotelRequest>, index: number = 0): HotelStaySegment | null {
    if (!hotels) return null;

    const segment: HotelStaySegment = {
        city: hotels.city,
        hotelName: hotels.hotelName,
        hotelNames: hotels.hotelNames,
        checkinDate: hotels.checkinDate,
        checkoutDate: hotels.checkoutDate,
        adults: hotels.adults,
        adultsExplicit: hotels.adultsExplicit,
        children: hotels.children,
        childrenAges: hotels.childrenAges,
        infants: hotels.infants,
        roomType: hotels.roomType,
        hotelChains: hotels.hotelChains,
        mealPlan: hotels.mealPlan,
        freeCancellation: hotels.freeCancellation,
        roomView: hotels.roomView,
        roomCount: hotels.roomCount
    };

    const hasContent = Object.values(segment).some((value) =>
        value !== undefined && value !== null && value !== ''
    );

    if (!hasContent) return null;

    return {
        ...segment,
        id: buildHotelSegmentId(segment, index)
    };
}

function inheritHotelSegment(
    partialSegment: HotelStaySegment,
    fallbackSegment: HotelStaySegment | null,
    index: number
): HotelStaySegment {
    const merged: HotelStaySegment = {
        ...fallbackSegment,
        ...partialSegment,
        hotelChains: partialSegment.hotelChains ?? fallbackSegment?.hotelChains,
        hotelNames: partialSegment.hotelNames ?? fallbackSegment?.hotelNames,
        childrenAges: partialSegment.childrenAges ?? fallbackSegment?.childrenAges
    };

    return {
        ...merged,
        id: partialSegment.id || merged.id || buildHotelSegmentId(merged, index)
    };
}

export function getHotelSegments(hotels?: HotelRequest): HotelStaySegment[] {
    if (!hotels) return [];

    const fallback = buildHotelSegmentFromRequest(hotels, 0);

    if (!Array.isArray(hotels.segments) || hotels.segments.length === 0) {
        return fallback ? [fallback] : [];
    }

    return hotels.segments.reduce<HotelStaySegment[]>((acc, current, index) => {
        const inheritedFrom = acc[index - 1] || fallback;
        acc.push(inheritHotelSegment(current, inheritedFrom, index));
        return acc;
    }, []);
}

export function getPrimaryHotelRequest(hotels?: HotelRequest): HotelRequest | undefined {
    if (!hotels) return undefined;

    const [firstSegment] = getHotelSegments(hotels);
    if (!firstSegment) return hotels;

    return {
        ...hotels,
        city: firstSegment.city || hotels.city,
        hotelName: firstSegment.hotelName || hotels.hotelName,
        hotelNames: firstSegment.hotelNames || hotels.hotelNames,
        checkinDate: firstSegment.checkinDate || hotels.checkinDate,
        checkoutDate: firstSegment.checkoutDate || hotels.checkoutDate,
        adults: firstSegment.adults ?? hotels.adults,
        adultsExplicit: firstSegment.adultsExplicit ?? hotels.adultsExplicit,
        children: firstSegment.children ?? hotels.children,
        childrenAges: firstSegment.childrenAges ?? hotels.childrenAges,
        infants: firstSegment.infants ?? hotels.infants,
        roomType: firstSegment.roomType || hotels.roomType,
        hotelChains: firstSegment.hotelChains || hotels.hotelChains,
        mealPlan: firstSegment.mealPlan || hotels.mealPlan,
        freeCancellation: firstSegment.freeCancellation ?? hotels.freeCancellation,
        roomView: firstSegment.roomView || hotels.roomView,
        roomCount: firstSegment.roomCount ?? hotels.roomCount,
        segments: getHotelSegments(hotels)
    };
}

function extractHotelSegmentsFromMessage(
    message: string,
    baseHotels?: HotelRequest,
    detectors?: {
        detectMultipleHotelChains?: (text: string) => string[];
        detectMultipleHotelNames?: (text: string) => string[];
    }
): HotelStaySegment[] | undefined {
    const chunks = splitHotelMessageIntoChunks(message);
    if (chunks.length < 2) {
        return baseHotels?.segments && baseHotels.segments.length > 1 ? getHotelSegments(baseHotels) : undefined;
    }

    const baseSegment = buildHotelSegmentFromRequest(baseHotels, 0);
    const segments: HotelStaySegment[] = [];

    chunks.forEach((chunk, index) => {
        const previousSegment = segments[index - 1] || baseSegment || null;
        const detectedNames = detectors?.detectMultipleHotelNames?.(chunk) || [];
        const detectedChains = detectedNames.length === 0
            ? (detectors?.detectMultipleHotelChains?.(chunk) || [])
            : [];
        const { adults, adultsExplicit } = detectAdultsFromText(chunk);
        const dates = parseHotelDateRangeFromText(chunk, previousSegment || undefined);

        const partialSegment: HotelStaySegment = {
            city: detectHotelCityFromText(chunk),
            checkinDate: dates.checkinDate,
            checkoutDate: dates.checkoutDate,
            adults: adults ?? (detectRoomTypeFromText(chunk) === 'double' ? 2 : detectRoomTypeFromText(chunk) === 'triple' ? 3 : detectRoomTypeFromText(chunk) === 'single' ? 1 : undefined),
            adultsExplicit,
            roomType: detectRoomTypeFromText(chunk),
            mealPlan: detectMealPlanFromText(chunk),
            hotelNames: detectedNames.length > 0 ? detectedNames : undefined,
            hotelChains: detectedChains.length > 0 ? detectedChains : undefined
        };

        const segment = inheritHotelSegment(partialSegment, previousSegment, index);
        const hasCoreFields = segment.city || segment.checkinDate || segment.checkoutDate;

        if (hasCoreFields) {
            segments.push(segment);
        }
    });

    return segments.length > 1 ? segments : undefined;
}

function normalizeIncomingHotelsPayload(rawHotels: unknown): Partial<HotelRequest> | undefined {
    if (!rawHotels) return undefined;

    if (Array.isArray(rawHotels)) {
        const rawSegments = rawHotels
            .filter((segment): segment is Record<string, unknown> => Boolean(segment) && typeof segment === 'object')
            .map((segment, index) => ({
                id: buildHotelSegmentId(segment as Partial<HotelStaySegment>, index),
                city: typeof segment.city === 'string' ? segment.city : undefined,
                hotelName: typeof segment.hotelName === 'string' ? segment.hotelName : undefined,
                hotelNames: Array.isArray(segment.hotelNames) ? segment.hotelNames as string[] : undefined,
                checkinDate: typeof segment.checkinDate === 'string' ? segment.checkinDate : undefined,
                checkoutDate: typeof segment.checkoutDate === 'string' ? segment.checkoutDate : undefined,
                adults: typeof segment.adults === 'number' ? segment.adults : undefined,
                adultsExplicit: typeof segment.adultsExplicit === 'boolean' ? segment.adultsExplicit : undefined,
                children: typeof segment.children === 'number' ? segment.children : undefined,
                childrenAges: Array.isArray(segment.childrenAges) ? segment.childrenAges as number[] : undefined,
                infants: typeof segment.infants === 'number' ? segment.infants : undefined,
                roomType: typeof segment.roomType === 'string' ? segment.roomType as HotelStaySegment['roomType'] : undefined,
                hotelChains: Array.isArray(segment.hotelChains) ? segment.hotelChains as string[] : undefined,
                mealPlan: typeof segment.mealPlan === 'string' ? segment.mealPlan as HotelStaySegment['mealPlan'] : undefined,
                freeCancellation: typeof segment.freeCancellation === 'boolean' ? segment.freeCancellation : undefined,
                roomView: typeof segment.roomView === 'string' ? segment.roomView as HotelStaySegment['roomView'] : undefined,
                roomCount: typeof segment.roomCount === 'number' ? segment.roomCount : undefined
            }));

        if (rawSegments.length === 0) return undefined;
        return buildHotelRequestFromSegments(rawSegments, rawSegments[0]);
    }

    if (typeof rawHotels === 'object') {
        // Detect numeric-keyed objects from AI (e.g. {0: {...}, 1: {...}}) and convert to array
        const keys = Object.keys(rawHotels as Record<string, unknown>);
        const isNumericKeyed = keys.length > 0 && keys.every(k => /^\d+$/.test(k));
        if (isNumericKeyed) {
            const asArray = keys
                .sort((a, b) => Number(a) - Number(b))
                .map(k => (rawHotels as Record<string, unknown>)[k]);
            return normalizeIncomingHotelsPayload(asArray);
        }
        return rawHotels as Partial<HotelRequest>;
    }

    return undefined;
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
    const segments = getHotelSegments(hotels);
    const hotelSegments = segments.length > 0 ? segments : [hotels];

    for (let index = 0; index < hotelSegments.length; index += 1) {
        const segment = hotelSegments[index];
        const label = hotelSegments.length > 1
            ? (segment.city ? `${segment.city}` : `tramo ${index + 1}`)
            : '';

        // 🚨 CRITICAL: Check for "only minors" FIRST - children/infants without adults
        const hasOnlyMinors = (segment.adults === 0 || !segment.adults) &&
            (((segment.children ?? 0) > 0) || ((segment.infants ?? 0) > 0));

        if (hasOnlyMinors) {
            console.log('⚠️ [VALIDATION] Only minors detected in hotel search without adults - rejecting');
            return {
                isValid: false,
                missingFields: ['adults'],
                missingFieldsSpanish: ['adulto acompañante'],
                errorMessage: `⚠️ **Los menores no pueden hospedarse solos**\n\nLos niños y bebés deben estar acompañados por al menos un adulto responsable${label ? ` en ${label}` : ''}.\n\n**¿Cuántos adultos los acompañarán?**\n\nPor ejemplo: "agrega 1 adulto", "con 2 adultos"`
            };
        }

        // Validar campos requeridos (roomType y mealPlan son OPCIONALES)
        if (!segment.city) {
            missingFields.push(hotelSegments.length > 1 ? `segment_${index + 1}_city` : 'city');
            missingFieldsSpanish.push(hotelSegments.length > 1 ? `destino de ${label}` : 'destino');
        }
        if (!segment.checkinDate) {
            missingFields.push(hotelSegments.length > 1 ? `segment_${index + 1}_checkinDate` : 'checkinDate');
            missingFieldsSpanish.push(hotelSegments.length > 1 ? `fecha de entrada de ${label}` : 'fecha de entrada');
        }
        if (!segment.checkoutDate) {
            missingFields.push(hotelSegments.length > 1 ? `segment_${index + 1}_checkoutDate` : 'checkoutDate');
            missingFieldsSpanish.push(hotelSegments.length > 1 ? `fecha de salida de ${label}` : 'fecha de salida');
        }
        if (!segment.adults || segment.adults < 1) {
            missingFields.push(hotelSegments.length > 1 ? `segment_${index + 1}_adults` : 'adults');
            missingFieldsSpanish.push(hotelSegments.length > 1 ? `cantidad de pasajeros de ${label}` : 'cantidad de pasajeros');
        }
    }

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
            missingFields: ['destinations', 'exact_dates'],
            missingFieldsSpanish: ['destino(s)', 'fechas exactas del viaje']
        };
    }

    const missingFields: string[] = [];
    const missingFieldsSpanish: string[] = [];

    // Validar campos requeridos
    if (!itinerary.destinations || itinerary.destinations.length === 0) {
        missingFields.push('destinations');
        missingFieldsSpanish.push('destino(s)');
    }
    if (!hasUsableItineraryDates(itinerary)) {
        missingFields.push('exact_dates');
        missingFieldsSpanish.push('fechas exactas del viaje');
    }

    return {
        isValid: missingFields.length === 0,
        missingFields,
        missingFieldsSpanish
    };
}

// Función para generar mensaje solicitando información faltante
function generateItineraryDateClarificationMessage(
    itinerary?: ParsedTravelRequest['itinerary'],
    originalMessage: string = '',
    referenceDate: Date = new Date()
): string {
    const suggestedRanges = buildSuggestedItineraryDateRanges(itinerary, originalMessage, referenceDate);
    const normalizedReference = new Date(referenceDate);
    normalizedReference.setHours(0, 0, 0, 0);
    const monthHint = extractItineraryMonthHint(originalMessage);
    const destinations = itinerary?.destinations?.length
        ? itinerary.destinations.join(', ')
        : undefined;
    const monthSummary = monthHint
        ? `${getMonthNameFromNumber(monthHint.monthNum)} de ${getTargetYearForMonthHint(monthHint, normalizedReference)}`
        : undefined;

    const contextLines = [
        destinations ? `• **Destinos:** ${destinations}` : '',
        itinerary?.days ? `• **Duración estimada:** ${itinerary.days} días` : '',
        monthSummary ? `• **Mes solicitado:** ${monthSummary}` : ''
    ].filter(Boolean);

    const suggestionsBlock = suggestedRanges.length > 0
        ? suggestedRanges.map((option, index) => `${index + 1}. ${option.label}`).join('\n')
        : 'Por ejemplo:\n1. Del 2 al 11 de mayo de 2026\n2. Del 9 al 18 de mayo de 2026\n3. Del 16 al 25 de mayo de 2026';

    const destText = destinations || 'tu destino';
    const greeting = `¡Qué lindo viaje a **${destText}**! Ya me lo estoy imaginando.`;
    const dateAsk = `Solo me falta un dato para ponerme a armar todo: **¿en qué fechas te gustaría ir?**`;
    const suggestionsPart = suggestedRanges.length > 0
        ? `\n\nSi te sirve como referencia, te dejo algunas opciones:\n${suggestionsBlock}`
        : '';

    return `${greeting}${contextLines.length > 0 ? `\n\n${contextLines.join('\n')}` : ''}\n\n${dateAsk}\n\nPodés escribirme algo como **"del 6 al 15 de mayo"** o elegir las fechas desde el botón de abajo.${suggestionsPart}`;
}

export function generateMissingInfoMessage(
    missingFieldsSpanish: string[],
    requestType: string,
    context?: {
        itinerary?: ParsedTravelRequest['itinerary'];
        originalMessage?: string;
        referenceDate?: Date;
    }
): string {
    if (
        requestType === 'itinerary' &&
        missingFieldsSpanish.includes('fechas exactas del viaje') &&
        context?.itinerary?.destinations &&
        context.itinerary.destinations.length > 0
    ) {
        return generateItineraryDateClarificationMessage(
            context?.itinerary,
            context?.originalMessage || '',
            context?.referenceDate
        );
    }

    const baseMessage = requestType === 'flights'
        ? '¡Me encanta! Para encontrarte los mejores vuelos necesito que me cuentes un poquito más:'
        : requestType === 'hotels'
            ? '¡Genial! Para buscar los hoteles ideales necesito algunos datos más:'
            : requestType === 'itinerary'
                ? '¡Me encanta la idea del viaje! Para armar un itinerario a tu medida, necesito que me cuentes:'
                : '¡Buenísimo! Para buscar las mejores opciones necesito un poco más de info:';

    const fieldsList = missingFieldsSpanish.map((field, index) =>
        `${index + 1}. **${field.charAt(0).toUpperCase() + field.slice(1)}**`
    ).join('\n');

    const examples = generateFieldExamples(missingFieldsSpanish);

    return `${baseMessage}

${fieldsList}

${examples}

Contame y me pongo a buscar.`;
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
            case 'fecha de entrada':
                examples.push('📅 **Fecha de entrada:** Por ejemplo: "15 de diciembre", "2025-12-15"');
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
            case 'cantidad de días o fechas del viaje':
                examples.push('📅 **Duración o fechas:** Por ejemplo: "5 días", "del 2 al 10 de marzo", "del 2027-03-02 al 2027-03-10"');
                break;
            case 'fechas exactas del viaje':
                examples.push('📅 **Fechas exactas:** Por ejemplo: "del 2 al 10 de marzo de 2027", "salgo el 5 de mayo y vuelvo el 14 de mayo"');
                break;
        }
    });

    if (examples.length > 0) {
        return '**Ejemplos:**\n\n' + examples.join('\n\n');
    }

    return '';
}

function buildHotelRequestFromSegments(
    segments: HotelStaySegment[],
    baseHotels?: Partial<HotelRequest>
): HotelRequest {
    const [firstSegment] = segments;

    return {
        city: firstSegment?.city || baseHotels?.city || '',
        hotelName: firstSegment?.hotelName || baseHotels?.hotelName,
        hotelNames: firstSegment?.hotelNames || baseHotels?.hotelNames,
        checkinDate: firstSegment?.checkinDate || baseHotels?.checkinDate || '',
        checkoutDate: firstSegment?.checkoutDate || baseHotels?.checkoutDate || '',
        adults: firstSegment?.adults ?? baseHotels?.adults ?? 0,
        adultsExplicit: firstSegment?.adultsExplicit ?? baseHotels?.adultsExplicit,
        children: firstSegment?.children ?? baseHotels?.children ?? 0,
        childrenAges: firstSegment?.childrenAges ?? baseHotels?.childrenAges,
        infants: firstSegment?.infants ?? baseHotels?.infants,
        roomType: firstSegment?.roomType || baseHotels?.roomType,
        hotelChains: firstSegment?.hotelChains || baseHotels?.hotelChains,
        mealPlan: firstSegment?.mealPlan || baseHotels?.mealPlan,
        freeCancellation: firstSegment?.freeCancellation ?? baseHotels?.freeCancellation,
        roomView: firstSegment?.roomView || baseHotels?.roomView,
        roomCount: firstSegment?.roomCount ?? baseHotels?.roomCount,
        segments
    };
}

function combineHotelRequests(
    previousHotels?: HotelRequest,
    newHotels?: HotelRequest,
    newMessage?: string
): HotelRequest | undefined {
    if (!previousHotels) return newHotels;
    if (!newHotels) return previousHotels;

    const previousSegments = getHotelSegments(previousHotels);
    const newSegments = getHotelSegments(newHotels);
    const normalizedMessage = normalizeHotelText(newMessage || '');
    const addSegmentIntent = /\b(y en|luego en|despues en|despues|después en|ademas en|además en)\b/i.test(normalizedMessage);
    const hasSegmentModel = previousSegments.length > 1 || newSegments.length > 1 || addSegmentIntent;

    if (!hasSegmentModel) {
        return undefined;
    }

    const fallbackSegment = previousSegments[previousSegments.length - 1] || buildHotelSegmentFromRequest(previousHotels, 0);
    const workingSegments = previousSegments.map((segment, index) => ({
        ...segment,
        id: segment.id || buildHotelSegmentId(segment, index)
    }));

    if (newSegments.length > 1) {
        return buildHotelRequestFromSegments(
            newSegments.map((segment, index) => inheritHotelSegment(segment, index === 0 ? fallbackSegment : newSegments[index - 1], index)),
            { ...previousHotels, ...newHotels }
        );
    }

    if (newSegments.length === 0) {
        return buildHotelRequestFromSegments(
            workingSegments.map((segment, index) =>
                inheritHotelSegment(newHotels as HotelStaySegment, segment, index)
            ),
            { ...previousHotels, ...newHotels }
        );
    }

    const incomingSegment = inheritHotelSegment(newSegments[0], fallbackSegment, workingSegments.length);
    const matchingIndex = incomingSegment.city
        ? workingSegments.findIndex((segment) => normalizeHotelText(segment.city || '') === normalizeHotelText(incomingSegment.city || ''))
        : -1;

    if (matchingIndex >= 0) {
        const merged = inheritHotelSegment(incomingSegment, workingSegments[matchingIndex], matchingIndex);
        workingSegments[matchingIndex] = { ...merged, id: merged.id || buildHotelSegmentId(merged, matchingIndex) };
        return buildHotelRequestFromSegments(workingSegments, { ...previousHotels, ...newHotels });
    }

    if (addSegmentIntent || previousSegments.length > 1) {
        const idx = workingSegments.length;
        workingSegments.push({ ...incomingSegment, id: incomingSegment.id || buildHotelSegmentId(incomingSegment, idx) });
        return buildHotelRequestFromSegments(workingSegments, { ...previousHotels, ...newHotels });
    }

    return undefined;
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
        const combinedSegmentedHotels = combineHotelRequests(
            normalizedPreviousRequest.hotels,
            normalizedParsedNewRequest.hotels,
            newMessage
        );

        if (combinedSegmentedHotels) {
            normalizedParsedNewRequest.hotels = combinedSegmentedHotels;
        } else {
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
            ...(normalizedParsedNewRequest.hotels?.roomCount && { roomCount: normalizedParsedNewRequest.hotels.roomCount }),
            ...(normalizedParsedNewRequest.hotels?.segments && normalizedParsedNewRequest.hotels.segments.length > 0 && {
                segments: normalizedParsedNewRequest.hotels.segments
            })
        };

        normalizedParsedNewRequest.hotels = combinedHotels;
        }
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

    if (normalizedParsedNewRequest.requestType === 'itinerary') {
        normalizedParsedNewRequest.itinerary = {
            ...normalizedPreviousRequest.itinerary,
            ...normalizedParsedNewRequest.itinerary,
            ...(normalizedParsedNewRequest.itinerary?.destinations?.length ? { destinations: normalizedParsedNewRequest.itinerary.destinations } : {}),
            ...(normalizedParsedNewRequest.itinerary?.days ? { days: normalizedParsedNewRequest.itinerary.days } : {}),
            ...(normalizedParsedNewRequest.itinerary?.startDate ? { startDate: normalizedParsedNewRequest.itinerary.startDate } : {}),
            ...(normalizedParsedNewRequest.itinerary?.endDate ? { endDate: normalizedParsedNewRequest.itinerary.endDate } : {}),
            ...(normalizedParsedNewRequest.itinerary?.isFlexibleDates !== undefined ? { isFlexibleDates: normalizedParsedNewRequest.itinerary.isFlexibleDates } : {}),
            ...(normalizedParsedNewRequest.itinerary?.flexibleMonth ? { flexibleMonth: normalizedParsedNewRequest.itinerary.flexibleMonth } : {}),
            ...(normalizedParsedNewRequest.itinerary?.flexibleYear ? { flexibleYear: normalizedParsedNewRequest.itinerary.flexibleYear } : {}),
            ...(normalizedParsedNewRequest.itinerary?.dateSelectionSource ? { dateSelectionSource: normalizedParsedNewRequest.itinerary.dateSelectionSource } : {}),
            ...(normalizedParsedNewRequest.itinerary?.budgetLevel ? { budgetLevel: normalizedParsedNewRequest.itinerary.budgetLevel } : {}),
            ...(normalizedParsedNewRequest.itinerary?.budgetAmount ? { budgetAmount: normalizedParsedNewRequest.itinerary.budgetAmount } : {}),
            ...(normalizedParsedNewRequest.itinerary?.interests?.length ? { interests: normalizedParsedNewRequest.itinerary.interests } : {}),
            ...(normalizedParsedNewRequest.itinerary?.travelStyle?.length ? { travelStyle: normalizedParsedNewRequest.itinerary.travelStyle } : {}),
            ...(normalizedParsedNewRequest.itinerary?.pace ? { pace: normalizedParsedNewRequest.itinerary.pace } : {}),
            ...(normalizedParsedNewRequest.itinerary?.hotelCategory ? { hotelCategory: normalizedParsedNewRequest.itinerary.hotelCategory } : {}),
            ...(normalizedParsedNewRequest.itinerary?.travelers ? { travelers: normalizedParsedNewRequest.itinerary.travelers } : {}),
            ...(normalizedParsedNewRequest.itinerary?.constraints?.length ? { constraints: normalizedParsedNewRequest.itinerary.constraints } : {}),
            ...(normalizedParsedNewRequest.itinerary?.currentPlanSummary ? { currentPlanSummary: normalizedParsedNewRequest.itinerary.currentPlanSummary } : {}),
            ...(normalizedParsedNewRequest.itinerary?.editIntent ? { editIntent: normalizedParsedNewRequest.itinerary.editIntent } : {}),
        };
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
    conversationHistory?: Array<{ role: string, content: string, timestamp: string }>,
    knowledge?: ParseMessageKnowledge,
): Promise<ParsedTravelRequest> {
    const timer = createDebugTimer('AI PARSER', {
        messageLength: message.length,
        historyLength: conversationHistory?.length || 0,
        hasPreviousContext: Boolean(previousContext),
    });
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
            const requestedDay = parseInt(fechaMatch[1], 10);
            const currentDay = now.getDate();
            const año = (requestedMonth < currentMonth || (requestedMonth === currentMonth && requestedDay < currentDay))
                ? (currentYear + 1).toString() : currentYear.toString();

            quick.flights.departureDate = `${año}-${mesNum}-${fechaMatch[1].padStart(2, '0')}`;

            if (fechaMatch[3]) {
                // Si hay mes de vuelta explícito, usarlo; sino usar el mismo mes de ida
                const mes2 = fechaMatch[4] ? fechaMatch[4].toLowerCase() : mes;
                const mes2Num = meses[mes2] || mesNum;
                const requestedMonth2 = parseInt(mes2Num, 10);
                // For return date, compare with current month and consider if it wraps to next year
                const requestedDay2 = parseInt(fechaMatch[3], 10);
                const año2 = (requestedMonth2 < currentMonth || (requestedMonth2 === currentMonth && requestedDay2 < currentDay))
                    ? (currentYear + 1).toString()
                    : (requestedMonth2 < requestedMonth ? (parseInt(año) + 1).toString() : año);
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
            const requestedDay = parseInt(fechaAltMatch[1], 10);
            const currentDay = now.getDate();
            const año = (requestedMonth < currentMonth || (requestedMonth === currentMonth && requestedDay < currentDay))
                ? (currentYear + 1).toString() : currentYear.toString();

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
    timer.checkpoint('Quick pre-parser completed');

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
    timer.checkpoint('Time preference pre-parser completed');

    try {
        console.log('🚀 Calling OpenAI via Supabase Edge Function...');
        console.log('📚 [CONTEXT] Sending conversation history:', {
            historyLength: conversationHistory?.length || 0,
            hasPreviousContext: !!previousContext
        });

        const invokeStart = nowMs();
        const response = await supabase.functions.invoke('ai-message-parser', {
            body: {
                message,
                language: 'es', // Spanish
                currentDate: new Date().toISOString().split('T')[0],
                previousContext: previousContext, // Include conversation context
                conversationHistory: conversationHistory || [],
                conversationSummary: knowledge?.conversationSummary ?? null,
                leadProfile: knowledge?.leadProfile ?? null,
                plannerContext: knowledge?.plannerContext ?? null,
                historyWindow: knowledge?.historyWindow ?? 6,
                contextMeta: knowledge?.contextMeta ?? null,
            }
        });
        logTimingStep('AI PARSER', 'invoke ai-message-parser', invokeStart, {
            hasError: Boolean(response.error),
            historyLength: conversationHistory?.length || 0,
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
        console.log('🌍 [GEO-TRACE-1] Raw Edge Function destinations:', parsedResult.requestType, parsedResult.itinerary?.destinations);
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
        const normalizedParsedHotels = normalizeIncomingHotelsPayload(parsedResult.hotels);
        const quickHotels = (quick as any).hotels;
        const mergedHotels = {
            ...(normalizedParsedHotels || {}),
            // If AI didn't detect hotelChains but pre-parser did → use pre-parser value (array)
            ...(quickHotels?.hotelChains && !(normalizedParsedHotels as any)?.hotelChains ? { hotelChains: quickHotels.hotelChains } : {}),
            // If AI didn't detect hotelName but pre-parser did → use pre-parser value
            ...(quickHotels?.hotelName && !(normalizedParsedHotels as any)?.hotelName ? { hotelName: quickHotels.hotelName } : {}),
            // If AI didn't detect hotelNames (plural) but pre-parser did → use pre-parser value (array of specific hotel names)
            ...(quickHotels?.hotelNames && !(normalizedParsedHotels as any)?.hotelNames ? { hotelNames: quickHotels.hotelNames } : {})
        } as any;

        // Log merge details for debugging
        if (quickHotels?.hotelChains || quickHotels?.hotelName || quickHotels?.hotelNames) {
            console.log(`🏨 [MERGE] Pre-parser hotel hints:`, quickHotels);
            console.log(`🏨 [MERGE] AI detected hotels:`, parsedResult.hotels);
            console.log(`🏨 [MERGE] Final merged hotels:`, mergedHotels);
        }

        const postProcessStart = nowMs();
        const { detectMultipleHotelChains, detectMultipleHotelNames } = await import('@/features/chat/data/hotelChainAliases');
        const extractedHotelSegments = extractHotelSegmentsFromMessage(message, mergedHotels as HotelRequest, {
            detectMultipleHotelChains,
            detectMultipleHotelNames
        });
        const normalizedHotels = extractedHotelSegments && extractedHotelSegments.length > 1
            ? buildHotelRequestFromSegments(extractedHotelSegments, mergedHotels as HotelRequest)
            : mergedHotels;
        const hasMeaningfulFlights = parsedResult.flights && Object.keys(parsedResult.flights).length > 0;
        const normalizedRequestType =
            extractedHotelSegments && extractedHotelSegments.length > 1 && !hasMeaningfulFlights && parsedResult.requestType === 'combined'
                ? 'hotels'
                : extractedHotelSegments && extractedHotelSegments.length > 1 && parsedResult.requestType === 'general'
                    ? 'hotels'
                    : parsedResult.requestType;

        const normalizedResult = normalizeLocationsToCountryCapitals(normalizeParsedFlightRequest({
            ...parsedResult,
            flights: Object.keys(mergedFlights).length ? mergedFlights : parsedResult.flights,
            // Only include hotels if there's actual data (not empty object)
            hotels: Object.keys(normalizedHotels).length ? normalizedHotels : parsedResult.hotels,
            requestType: normalizedRequestType,
            originalMessage: message
        }));

        // Guardrail: restore country names if parser collapsed them to capitals
        const mergedResult = restoreCountryDestinationsForItinerary(normalizedResult, message);

        console.log('🌍 [GEO-TRACE-2] After merge/post-processing destinations:', mergedResult.itinerary?.destinations);
        console.log('✅ AI parsing successful (merged with quick hints when missing):', mergedResult);
        logTimingStep('AI PARSER', 'post-processing', postProcessStart, {
            requestType: mergedResult.requestType,
            hasFlights: Boolean(mergedResult.flights),
            hasHotels: Boolean(mergedResult.hotels),
        });
        timer.end('total', {
            requestType: mergedResult.requestType,
            hasFlights: Boolean(mergedResult.flights),
            hasHotels: Boolean(mergedResult.hotels),
        });
        return mergedResult;

    } catch (error) {
        timer.fail('failed', error, {
            messageLength: message.length,
            historyLength: conversationHistory?.length || 0,
        });
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
            return validateHotelRequiredFields(normalizedParsed.hotels).isValid;

        case 'packages':
            return !!(normalizedParsed.packages?.destination && normalizedParsed.packages?.dateFrom && normalizedParsed.packages?.dateTo);

        case 'services':
            return !!(normalizedParsed.services?.city && normalizedParsed.services?.dateFrom);

        case 'combined':
            return validateParsedRequest({ ...normalizedParsed, requestType: 'flights' }) &&
                validateParsedRequest({ ...normalizedParsed, requestType: 'hotels' });

        case 'itinerary':
            return validateItineraryRequiredFields(normalizedParsed.itinerary).isValid;

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
            departureDate: ensureCorrectYear(normalizedParsed.flights.departureDate),
            returnDate: normalizedParsed.flights.returnDate ? ensureCorrectYear(normalizedParsed.flights.returnDate) : undefined,
            adults: normalizedParsed.flights.adults,
            children: normalizedParsed.flights.children,
            infants: normalizedParsed.flights.infants
        };
    }

    const primaryHotelRequest = getPrimaryHotelRequest(normalizedParsed.hotels);

    if (primaryHotelRequest) {
        result.hotelParams = {
            cityCode: primaryHotelRequest.city,
            hotelName: primaryHotelRequest.hotelName,
            checkinDate: primaryHotelRequest.checkinDate,
            checkoutDate: primaryHotelRequest.checkoutDate,
            adults: primaryHotelRequest.adults,
            children: primaryHotelRequest.children,
            childrenAges: primaryHotelRequest.childrenAges || [],
            infants: primaryHotelRequest.infants
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

function ensureCorrectYear(dateStr: string): string {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parsed = new Date(dateStr + 'T00:00:00');

    const diffDays = (parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    // If date is ~1 year away (358-372 days) but the same month+day in current year is within 7 days
    if (diffDays >= 358 && diffDays <= 372) {
        const currentYearDate = new Date(parsed);
        currentYearDate.setFullYear(today.getFullYear());
        const altDiffDays = (currentYearDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

        if (altDiffDays >= 0 && altDiffDays <= 7) {
            console.warn(`⚠️ [YEAR FIX] Corrected ${dateStr} → ${today.getFullYear()}-${dateStr.slice(5)} (was ~1 year from a near-future date)`);
            return `${today.getFullYear()}-${dateStr.slice(5)}`;
        }
    }

    return dateStr;
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
                FlightDate: ensureCorrectYear(segment.departureDate)
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
