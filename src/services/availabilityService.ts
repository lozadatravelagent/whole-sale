// Configuration constants
const WS_CONFIG = {
    url: 'https://ujigyazketblwlzcomve.supabase.co/functions/v1/eurovips-soap'
};

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqaWd5YXprZXRibHdsemNvbXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODk2MTEsImV4cCI6MjA3MjM2NTYxMX0.X6YvJfgQnCAzFXa37nli47yQxuRG-7WJnJeIDrqg5EA';

export interface AvailabilityCheckParams {
    destination: string;
    dateFrom: string;
    dateTo: string;
    serviceType: 'AEREO' | 'HOTEL' | 'PAQUETE' | 'SERVICIO';
    serviceSubtype?: 'AEROTERRESTRE' | 'TERRESTRE' | 'CIRCUITO';
}

export interface CountryInfo {
    code: string;
    name: string;
}

export interface AlternativeDestination {
    country: string;
    cities: string[];
    availableServices: string[];
}

/**
 * Verifica si hay disponibilidad para un destino específico en las fechas dadas
 */
export async function checkDestinationAvailability(params: AvailabilityCheckParams): Promise<boolean> {
    try {
        console.log(`🔍 AVAILABILITY CHECK - Destination: ${params.destination}, Dates: ${params.dateFrom} to ${params.dateTo}, Service: ${params.serviceType}`);

        const availableDestinations = await getCountryList({
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            activeFareType: params.serviceType,
            activeFareSubtype: params.serviceSubtype || 'AEROTERRESTRE'
        });

        // Buscar el destino en la lista de disponibles
        const destinationLower = params.destination.toLowerCase();

        const hasAvailability = availableDestinations.some(item => {
            // Verificar por nombre o código
            return item.name.toLowerCase().includes(destinationLower) ||
                item.code.toLowerCase().includes(destinationLower) ||
                destinationLower.includes(item.name.toLowerCase()) ||
                destinationLower.includes(item.code.toLowerCase());
        });

        console.log(`✅ AVAILABILITY RESULT - ${params.destination}: ${hasAvailability ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
        return hasAvailability;

    } catch (error) {
        console.error('❌ Availability check failed:', error);
        return false; // En caso de error, asumir no disponible
    }
}

/**
 * Obtiene destinos alternativos cuando el destino solicitado no está disponible
 */
export async function getAlternativeDestinations(params: AvailabilityCheckParams): Promise<AlternativeDestination[]> {
    try {
        console.log(`🔄 ALTERNATIVES SEARCH - Service: ${params.serviceType}, Dates: ${params.dateFrom} to ${params.dateTo}`);

        const availableDestinations = await getCountryList({
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            activeFareType: params.serviceType,
            activeFareSubtype: params.serviceSubtype || 'AEROTERRESTRE'
        });

        // Convertir a formato más amigable
        const alternatives: AlternativeDestination[] = availableDestinations
            .slice(0, 10) // Limitar a los primeros 10
            .map(item => ({
                country: item.name,
                cities: [item.code], // Usar el código como "ciudad"
                availableServices: [params.serviceType]
            }));

        const limitedAlternatives = alternatives;

        console.log(`✅ ALTERNATIVES FOUND - ${limitedAlternatives.length} destination(s) available`);
        return limitedAlternatives;

    } catch (error) {
        console.error('❌ Alternative destinations search failed:', error);
        return [];
    }
}

/**
 * Obtiene la lista de países y ciudades con disponibilidad desde EUROVips
 */
async function getCountryList(params: {
    dateFrom: string;
    dateTo: string;
    activeFareType: string;
    activeFareSubtype?: string;
}): Promise<CountryInfo[]> {
    try {
        const response = await fetch(WS_CONFIG.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                action: 'getCountryList',
                data: {
                    dateFrom: params.dateFrom,
                    dateTo: params.dateTo,
                    activeFareType: params.activeFareType,
                    activeFareSubtype: params.activeFareSubtype || 'AEROTERRESTRE'
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && Array.isArray(result.results)) {
            console.log(`📊 COUNTRY LIST - Found ${result.results.length} destinations with availability`);
            return result.results;
        } else {
            console.warn('⚠️ No results from getCountryList:', result);
            return [];
        }

    } catch (error) {
        console.error('❌ getCountryList failed:', error);
        return [];
    }
}

/**
 * Formatea la lista de destinos alternativos para mostrar al usuario
 */
export function formatAlternativeDestinations(alternatives: AlternativeDestination[]): string {
    if (alternatives.length === 0) {
        return "No se encontraron destinos alternativos disponibles.";
    }

    const topDestinations = alternatives.slice(0, 5);
    const destinationNames = topDestinations.map(dest => {
        if (dest.cities.length > 0) {
            // Mostrar destino y código
            return `• ${dest.country} (${dest.cities[0]})`;
        }
        return `• ${dest.country}`;
    });

    return destinationNames.join('\n');
}

/**
 * Función de utilidad para validar fechas
 */
export function validateDateRange(dateFrom: string, dateTo: string): boolean {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const now = new Date();

    return from >= now && to > from;
}
