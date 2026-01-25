/**
 * timeSlotMapper.ts
 *
 * Centraliza el mapeo de preferencias de horario (strings) a rangos numéricos HHMM.
 * Compatible con TimeRangeChip y sistema de filtrado.
 *
 * Uso:
 * - Parser: "que salga de noche" → departureTimePreference: "evening"
 * - Mapper: timePreferenceToRange("evening") → [1800, 2159]
 * - Búsqueda: Filtra vuelos con salida entre 18:00 y 21:59
 */

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export interface TimeRange {
    start: number; // HHMM format (ej: 600 = 06:00, 1430 = 14:30)
    end: number;   // HHMM format
    label: string; // Etiqueta en español para UI
    emoji: string; // Emoji visual
}

/**
 * Mapa de slots temporales a rangos numéricos
 * Alineado con TimeRangeChip.tsx para consistencia
 */
export const TIME_SLOT_MAP: Record<TimeSlot, TimeRange> = {
    morning: {
        start: 600,
        end: 1159,
        label: 'Mañana',
        emoji: '🌅'
    },
    afternoon: {
        start: 1200,
        end: 1759,
        label: 'Tarde',
        emoji: '☀️'
    },
    evening: {
        start: 1800,
        end: 2159,
        label: 'Noche',
        emoji: '🌆'
    },
    night: {
        start: 2200,
        end: 559, // Cruza medianoche: 22:00-05:59
        label: 'Madrugada',
        emoji: '🌙'
    },
};

/**
 * Sinónimos en español para mapear a TimeSlots
 * Permite flexibilidad en input del usuario
 */
const SPANISH_SYNONYMS: Record<string, TimeSlot> = {
    // Mañana
    'mañana': 'morning',
    'manana': 'morning',
    'temprano': 'morning',
    'madrugada': 'night', // Nota: "madrugada" mapea a 'night' (22:00-05:59)

    // Tarde
    'tarde': 'afternoon',
    'mediodia': 'afternoon',
    'mediodía': 'afternoon',
    'dia': 'afternoon',
    'día': 'afternoon',

    // Noche
    'noche': 'evening',
    'tarde-noche': 'evening',

    // Inglés (fallback)
    'morning': 'morning',
    'afternoon': 'afternoon',
    'evening': 'evening',
    'night': 'night',
};

/**
 * Convierte string de preferencia a rango numérico [HHMM, HHMM]
 *
 * @param preference - String de preferencia (ej: "noche", "tarde", "mañana")
 * @returns Rango numérico [start, end] o null si no se reconoce
 *
 * @example
 * timePreferenceToRange("noche") → [1800, 2159]
 * timePreferenceToRange("tarde") → [1200, 1759]
 * timePreferenceToRange("invalid") → null
 */
export function timePreferenceToRange(preference: string | undefined): [number, number] | null {
    if (!preference) return null;

    const normalized = preference.toLowerCase().trim();

    // Mapeo directo (si es un TimeSlot válido)
    const directSlot = TIME_SLOT_MAP[normalized as TimeSlot];
    if (directSlot) {
        return [directSlot.start, directSlot.end];
    }

    // Mapeo vía sinónimos
    const synonymSlot = SPANISH_SYNONYMS[normalized];
    if (synonymSlot) {
        const range = TIME_SLOT_MAP[synonymSlot];
        return [range.start, range.end];
    }

    // No se reconoce el patrón
    console.warn(`[TIME MAPPER] Unrecognized time preference: "${preference}"`);
    return null;
}

/**
 * Convierte rango numérico a label legible con emoji
 *
 * @param range - Rango numérico [HHMM, HHMM]
 * @returns Label formateado (ej: "🌅 Mañana") o null si no hay rango
 */
export function timeRangeToLabel(range: [number, number] | null): string | null {
    if (!range) return null;

    const [start, end] = range;

    // Buscar match exacto en TIME_SLOT_MAP
    for (const slot of Object.values(TIME_SLOT_MAP)) {
        if (slot.start === start && slot.end === end) {
            return `${slot.emoji} ${slot.label}`;
        }
    }

    // Fallback: formato manual HH:MM - HH:MM
    const startStr = timeNumberToString(start);
    const endStr = timeNumberToString(end);

    return `${startStr} - ${endStr}`;
}

/**
 * Convierte número HHMM a string "HH:MM"
 *
 * @param time - Número HHMM (ej: 830, 1445)
 * @returns String formateado "HH:MM"
 */
export function timeNumberToString(time: number): string {
    const hours = Math.floor(time / 100);
    const minutes = time % 100;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Convierte string "HH:MM" a número HHMM
 *
 * @param timeStr - String de tiempo "HH:MM"
 * @returns Número HHMM
 */
export function timeStringToNumber(timeStr: string): number {
    if (!timeStr) return 0;

    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 100 + (minutes || 0);
}

/**
 * Verifica si un tiempo HHMM está dentro de un rango
 * Maneja correctamente rangos que cruzan medianoche
 *
 * @param time - Tiempo a verificar (HHMM)
 * @param range - Rango [start, end]
 * @returns true si el tiempo está en el rango
 *
 * @example
 * isTimeInRange(1900, [1800, 2159]) → true (noche)
 * isTimeInRange(100, [2200, 559]) → true (madrugada, cruza medianoche)
 * isTimeInRange(700, [1200, 1759]) → false (no está en tarde)
 */
export function isTimeInRange(time: number, range: [number, number]): boolean {
    const [start, end] = range;

    // Caso especial: rango que cruza medianoche (ej: 2200-0559)
    // Madrugada: 22:00+ OR 00:00-05:59
    if (start > end) {
        return time >= start || time <= end;
    }

    // Caso normal: rango dentro del mismo día
    return time >= start && time <= end;
}

/**
 * Obtiene el TimeSlot correspondiente a un rango
 * Útil para reverse mapping
 *
 * @param range - Rango numérico [HHMM, HHMM]
 * @returns TimeSlot correspondiente o null
 */
export function rangeToTimeSlot(range: [number, number] | null): TimeSlot | null {
    if (!range) return null;

    const [start, end] = range;

    for (const [key, slot] of Object.entries(TIME_SLOT_MAP)) {
        if (slot.start === start && slot.end === end) {
            return key as TimeSlot;
        }
    }

    return null;
}

/**
 * Filter flights by departure time preference
 *
 * @param flights - Array of flight results
 * @param timePreference - Time preference string (morning, afternoon, evening, night)
 * @returns Filtered flights array and count of excluded flights
 */
export function filterFlightsByTimePreference(
    flights: any[],
    timePreference: string | undefined
): { flights: any[]; excludedCount: number } {
    if (!timePreference) {
        return { flights, excludedCount: 0 };
    }

    const range = timePreferenceToRange(timePreference);
    if (!range) {
        console.warn(`[TIME FILTER] Could not parse time preference: ${timePreference}`);
        return { flights, excludedCount: 0 };
    }

    console.log(`[TIME FILTER] Filtering for ${timePreference}: ${range[0]} - ${range[1]}`);

    let excludedCount = 0;

    const filteredFlights = flights.filter(flight => {
        // Get departure time from first leg
        const departureTime = flight.departure_time || flight.legs?.[0]?.options?.[0]?.segments?.[0]?.departure?.time;

        if (!departureTime) {
            // No departure time available, include flight
            return true;
        }

        const timeNumber = timeStringToNumber(departureTime);
        const isInRange = isTimeInRange(timeNumber, range);

        if (!isInRange) {
            console.log(`[TIME FILTER] Excluding flight ${flight.id}: departure ${departureTime} (${timeNumber}) not in range ${range[0]}-${range[1]}`);
            excludedCount++;
        }

        return isInRange;
    });

    console.log(`[TIME FILTER] Filtered ${flights.length} → ${filteredFlights.length} (excluded: ${excludedCount})`);

    return { flights: filteredFlights, excludedCount };
}
