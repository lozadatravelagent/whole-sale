import { getAirlineNameFromCode, getAirlineCodeFromName } from '@/features/chat/utils/flightHelpers';

/**
 * City name lookup table for common airport codes
 * Used as fallback when AI doesn't provide city names
 */
const AIRPORT_TO_CITY: Record<string, string> = {
    // Argentina
    'EZE': 'Buenos Aires',
    'AEP': 'Buenos Aires',
    'BUE': 'Buenos Aires',
    'COR': 'Córdoba',
    'MDZ': 'Mendoza',
    'BRC': 'Bariloche',
    'IGR': 'Iguazú',
    // Mexico
    'CUN': 'Cancún',
    'MEX': 'Ciudad de México',
    'GDL': 'Guadalajara',
    'SJD': 'Los Cabos',
    'PVR': 'Puerto Vallarta',
    // Caribbean
    'PUJ': 'Punta Cana',
    'SDQ': 'Santo Domingo',
    'HAV': 'La Habana',
    'SJU': 'San Juan',
    'MBJ': 'Montego Bay',
    // USA
    'MIA': 'Miami',
    'JFK': 'Nueva York',
    'LGA': 'Nueva York',
    'EWR': 'Nueva York',
    'LAX': 'Los Ángeles',
    'MCO': 'Orlando',
    'LAS': 'Las Vegas',
    'ATL': 'Atlanta',
    'DFW': 'Dallas',
    'ORD': 'Chicago',
    'FLL': 'Fort Lauderdale',
    // Central America
    'PTY': 'Ciudad de Panamá',
    // South America
    'SCL': 'Santiago',
    'LIM': 'Lima',
    'BOG': 'Bogotá',
    'GRU': 'São Paulo',
    'GIG': 'Río de Janeiro',
    'MVD': 'Montevideo',
    'ASU': 'Asunción',
    'UIO': 'Quito',
    'CCS': 'Caracas',
    // Europe
    'MAD': 'Madrid',
    'BCN': 'Barcelona',
    'FCO': 'Roma',
    'CDG': 'París',
    'LHR': 'Londres',
    'AMS': 'Ámsterdam',
    'FRA': 'Frankfurt',
    'LIS': 'Lisboa',
};

/**
 * Get city name from airport code
 */
export function getCityNameFromCode(code: string): string {
    return AIRPORT_TO_CITY[code?.toUpperCase()] || code;
}

/**
 * Smart price parser that handles both US and EU/Latino number formats
 * US Format: 2,549.32 (comma = thousands, dot = decimal)
 * EU/Latino Format: 2.549,32 (dot = thousands, comma = decimal)
 */
export function parsePrice(priceStr: string): number {
    if (!priceStr) return 0;

    // Remove currency symbols and whitespace
    let cleaned = priceStr.replace(/[^\d.,]/g, '');

    if (!cleaned) return 0;

    console.log('💰 [PARSE PRICE] Input:', priceStr, '→ Cleaned:', cleaned);

    // Count dots and commas to determine format
    const dotCount = (cleaned.match(/\./g) || []).length;
    const commaCount = (cleaned.match(/,/g) || []).length;
    const lastDotIndex = cleaned.lastIndexOf('.');
    const lastCommaIndex = cleaned.lastIndexOf(',');

    // No separators - simple case
    if (dotCount === 0 && commaCount === 0) {
        const result = parseFloat(cleaned);
        console.log('💰 [PARSE PRICE] No separators:', result);
        return result;
    }

    // Only dots - check if it's decimal or thousands separator
    if (dotCount > 0 && commaCount === 0) {
        const digitsAfterDot = cleaned.length - lastDotIndex - 1;
        console.log('💰 [PARSE PRICE] Dots only - digitsAfterDot:', digitsAfterDot, 'lastDotIndex:', lastDotIndex, 'length:', cleaned.length);

        // Explicit Latino format check: X.XXX (e.g., 1.485, 2.500)
        if (digitsAfterDot === 3 && lastDotIndex > 0 && cleaned.length >= 5) {
            const result = parseFloat(cleaned.replace(/\./g, ''));
            console.log('💰 [PARSE PRICE] Latino format (X.XXX):', result);
            return result;
        }

        // Decimal format: dot in last 1-2 positions (e.g., 10.5, 100.50)
        if (lastDotIndex >= cleaned.length - 3 && dotCount === 1 && digitsAfterDot <= 2) {
            const result = parseFloat(cleaned);
            console.log('💰 [PARSE PRICE] Decimal format:', result);
            return result;
        }

        // Multiple dots or dot not in decimal position = thousands separator
        const result = parseFloat(cleaned.replace(/\./g, ''));
        console.log('💰 [PARSE PRICE] Thousands separator:', result);
        return result;
    }

    // Only commas - check if it's decimal or thousands separator
    if (commaCount > 0 && dotCount === 0) {
        const digitsAfterComma = cleaned.length - lastCommaIndex - 1;

        // EU format with comma as decimal: X,XX (e.g., 10,50)
        if (lastCommaIndex >= cleaned.length - 3 && commaCount === 1 && digitsAfterComma <= 2) {
            const result = parseFloat(cleaned.replace(',', '.'));
            console.log('💰 [PARSE PRICE] EU decimal format:', result);
            return result;
        }

        // US thousands separator: X,XXX (e.g., 1,485)
        if (digitsAfterComma === 3 && lastCommaIndex > 0 && cleaned.length >= 5) {
            const result = parseFloat(cleaned.replace(/,/g, ''));
            console.log('💰 [PARSE PRICE] US thousands format:', result);
            return result;
        }

        // Multiple commas = thousands separator
        const result = parseFloat(cleaned.replace(/,/g, ''));
        console.log('💰 [PARSE PRICE] Multiple commas:', result);
        return result;
    }

    // Both dots and commas present - determine which comes last
    if (lastCommaIndex > lastDotIndex) {
        // Comma comes after dot = EU/Latino format (2.549,32)
        const result = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
        console.log('💰 [PARSE PRICE] EU/Latino format (X.XXX,XX):', result);
        return result;
    } else {
        // Dot comes after comma = US format (2,549.32)
        const result = parseFloat(cleaned.replace(/,/g, ''));
        console.log('💰 [PARSE PRICE] US format (X,XXX.XX):', result);
        return result;
    }
}

/**
 * Helper function to resolve airline name from code or partial name
 */
export function resolveAirlineName(airlineInput: string | undefined): string {
    if (!airlineInput || airlineInput.trim() === '') {
        return 'Aerolínea no especificada';
    }

    const input = airlineInput.trim();

    // If it looks like a 2-3 letter code, try to resolve it
    if (input.length <= 3 && /^[A-Z0-9]{2,3}$/i.test(input)) {
        const resolved = getAirlineNameFromCode(input.toUpperCase());
        if (resolved !== input.toUpperCase()) {
            return resolved;
        }
    }

    // If it's a name, try to get the code and then the full name
    const code = getAirlineCodeFromName(input);
    if (code !== input.toUpperCase()) {
        const fullName = getAirlineNameFromCode(code);
        if (fullName !== code) {
            return fullName;
        }
    }

    // If input already looks like a full name (more than 3 chars), return as is
    if (input.length > 3) {
        return input;
    }

    return 'Aerolínea no especificada';
}

/**
 * Helper function to parse date from PDF text
 */
export function parseDate(dateStr: string): string {
    try {
        dateStr = dateStr.trim();

        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
        }

        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) {
            const [day, month, year] = dateStr.split('-');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        const months: Record<string, string> = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
            'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
            'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12',
            'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
            'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
            'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        };

        const dateMatch = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
        if (dateMatch) {
            const [, day, monthName, year] = dateMatch;
            const monthNum = months[monthName.toLowerCase().substring(0, 3)];
            if (monthNum) {
                return `${year}-${monthNum}-${day.padStart(2, '0')}`;
            }
        }

        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + 7);
        return fallbackDate.toISOString().split('T')[0];

    } catch (error) {
        console.warn('Could not parse date:', dateStr, error);
        const fallbackDate = new Date();
        fallbackDate.setDate(fallbackDate.getDate() + 7);
        return fallbackDate.toISOString().split('T')[0];
    }
}

/**
 * Parse date range from PDF text (e.g., "01/11/2025 - 15/11/2025")
 */
export function parseDateRange(dateString: string): { departureDate: string; returnDate?: string } {
    if (!dateString) {
        return { departureDate: '2025-11-01' };
    }

    const separators = [' - ', ' / ', ' – ', ' — ', ' to ', ' al '];
    let dates: string[] = [dateString];

    for (const separator of separators) {
        if (dateString.includes(separator)) {
            dates = dateString.split(separator);
            break;
        }
    }

    const departureDate = parseDate(dates[0]?.trim() || '');
    const returnDate = dates.length > 1 ? parseDate(dates[1]?.trim() || '') : undefined;

    return {
        departureDate,
        returnDate
    };
}

/**
 * Parse flight route string to extract origin and destination
 */
export function parseFlightRoute(route: string): { origin: string; destination: string } {
    console.log('🛫 Parsing route:', route);

    const cleanRoute = route.replace(/[→–-]/g, '-').trim();

    // Pattern 1: EZE - MIA - PUJ (with connection)
    const connectionMatch = cleanRoute.match(/([A-Z]{3})\s*-\s*[A-Z]{3}\s*-\s*([A-Z]{3})/);
    if (connectionMatch) {
        return {
            origin: connectionMatch[1],
            destination: connectionMatch[2]
        };
    }

    // Pattern 2: EZE - PUJ (direct)
    const directMatch = cleanRoute.match(/([A-Z]{3})\s*-\s*([A-Z]{3})/);
    if (directMatch) {
        return {
            origin: directMatch[1],
            destination: directMatch[2]
        };
    }

    // Pattern 3: City names
    const cityMatch = cleanRoute.match(/(Buenos Aires|Madrid|Barcelona|Miami|Punta Cana|Cancún|Nueva York)\s*-\s*(Buenos Aires|Madrid|Barcelona|Miami|Punta Cana|Cancún|Nueva York)/i);
    if (cityMatch) {
        return {
            origin: mapCityToCode(cityMatch[1]),
            destination: mapCityToCode(cityMatch[2])
        };
    }

    console.warn('⚠️ Could not parse route:', route);
    return { origin: '', destination: '' };
}

/**
 * Map city names to airport codes
 */
function mapCityToCode(cityName: string): string {
    const cityMap: Record<string, string> = {
        'Buenos Aires': 'EZE',
        'Ezeiza': 'EZE',
        'Jorge Newbery': 'AEP',
        'Aeroparque': 'AEP',
        'Madrid': 'MAD',
        'Barcelona': 'BCN',
        'Miami': 'MIA',
        'Punta Cana': 'PUJ',
        'Cancún': 'CUN',
        'Nueva York': 'JFK'
    };

    return cityMap[cityName] || cityName;
}

/**
 * Calculate flight duration between two times
 */
export function calculateFlightDuration(departureTime?: string, arrivalTime?: string): string | null {
    if (!departureTime || !arrivalTime) return null;

    try {
        const [depHour, depMin] = departureTime.split(':').map(Number);
        const [arrHour, arrMin] = arrivalTime.split(':').map(Number);

        let depMinutes = depHour * 60 + depMin;
        let arrMinutes = arrHour * 60 + arrMin;

        if (arrMinutes < depMinutes) {
            arrMinutes += 24 * 60;
        }

        const durationMinutes = arrMinutes - depMinutes;
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;

        return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
    } catch {
        return null;
    }
}
