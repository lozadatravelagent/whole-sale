/**
 * Baggage Utilities for API Search
 *
 * Ported from src/utils/baggageUtils.ts
 * Provides baggage type detection and analysis for flight results
 */

export type BaggageType = 'checked' | 'carryon' | 'backpack' | 'checked-plus-carryon' | 'unspecified-carryon' | 'none';

export interface BaggageInfo {
    type: BaggageType;
    description: string;
    details?: string;
    checkedPieces?: number;
    hasCarryOn?: boolean;
    carryOnSpecified?: boolean;
}

export interface PerLegBaggageInfo {
    legNumber: number;
    airlineCode: string;
    baggageInfo: string;
    baggageQuantity: number;
    carryOnQuantity: string;
    carryOnWeight: string | null;
    carryOnDimensions: string | null;
    type: BaggageType;
}

/**
 * Determina el tipo de equipaje basado en los datos de la API según estándares GDS/OTAs
 *
 * Reglas conservadoras:
 * - Baggage: "0PC" → 0 piezas despachadas incluidas
 * - Baggage: "1PC" → 1 pieza despachada
 * - Baggage: "2PC" → 2 piezas despachadas
 * - CarryOnBagInfo.Quantity explícito → equipaje de mano especificado
 * - CarryOnBagInfo: null → equipaje de mano no especificado (no asumir carry-on básico)
 */
export function getBaggageType(
    baggage?: string,
    carryOnBagInfo?: {
        quantity?: string;
        weight?: string;
        dimensions?: string;
    } | null
): BaggageInfo {
    // Si no hay información de equipaje
    if (!baggage && !carryOnBagInfo) {
        return {
            type: 'none',
            description: 'Sin equipaje'
        };
    }

    // Extraer número de piezas de equipaje de bodega (solo patrón ^[0-9]+PC$)
    let checkedPieces = 0;
    if (baggage) {
        const checkedMatch = baggage.match(/^(\d+)PC$/);
        if (checkedMatch) {
            checkedPieces = parseInt(checkedMatch[1]);
        }
    }

    // Verificar equipaje de mano solo si viene explícito
    let hasCarryOn = false;
    let isBackpack = false;
    let carryOnSpecified = false;

    if (carryOnBagInfo && carryOnBagInfo.quantity) {
        carryOnSpecified = true;
        const quantity = parseInt(carryOnBagInfo.quantity);
        hasCarryOn = quantity > 0;
        isBackpack = hasCarryOn && isBackpackType(carryOnBagInfo);
    }

    // Determinar el tipo y descripción basado en las reglas conservadoras
    if (checkedPieces === 0 && !carryOnSpecified) {
        // 0PC + CarryOn:null → "Sin equipaje despachado. Equipaje de mano: no especificado."
        return {
            type: 'unspecified-carryon',
            description: 'Sin equipaje despachado. Equipaje de mano: no especificado.',
            checkedPieces: 0,
            carryOnSpecified: false
        };
    } else if (checkedPieces === 0 && carryOnSpecified && hasCarryOn) {
        // 0PC + CarryOn:{Quantity:"1"} → Solo carry on/mochila especificado
        return {
            type: isBackpack ? 'backpack' : 'carryon',
            description: isBackpack ? 'Mochila' : '1 de mano',
            details: carryOnBagInfo?.weight || carryOnBagInfo?.dimensions || undefined,
            hasCarryOn: true,
            carryOnSpecified: true
        };
    } else if (checkedPieces === 0 && carryOnSpecified && !hasCarryOn) {
        // 0PC + CarryOn:{Quantity:"0"} → Sin equipaje
        return {
            type: 'none',
            description: 'Sin equipaje despachado ni de mano',
            checkedPieces: 0,
            carryOnSpecified: true
        };
    } else if (checkedPieces > 0 && !carryOnSpecified) {
        // 1PC/2PC + CarryOn:null → "X despachadas. Equipaje de mano: no especificado."
        return {
            type: 'unspecified-carryon',
            description: `${checkedPieces} despachada${checkedPieces > 1 ? 's' : ''}. Equipaje de mano: no especificado.`,
            details: baggage,
            checkedPieces,
            carryOnSpecified: false
        };
    } else if (checkedPieces > 0 && carryOnSpecified && hasCarryOn) {
        // 1PC/2PC + CarryOn:{Quantity:"1"} → "X despachadas + 1 de mano."
        const carryOnDesc = isBackpack ? '1 mochila' : '1 de mano';
        return {
            type: 'checked-plus-carryon',
            description: `${checkedPieces} despachada${checkedPieces > 1 ? 's' : ''} + ${carryOnDesc}.`,
            details: baggage,
            checkedPieces,
            hasCarryOn: true,
            carryOnSpecified: true
        };
    } else if (checkedPieces > 0 && carryOnSpecified && !hasCarryOn) {
        // 1PC/2PC + CarryOn:{Quantity:"0"} → Solo despachadas
        return {
            type: 'checked',
            description: `${checkedPieces} despachada${checkedPieces > 1 ? 's' : ''}. Sin equipaje de mano.`,
            details: baggage,
            checkedPieces,
            carryOnSpecified: true
        };
    }

    // Fallback
    return {
        type: 'none',
        description: 'Sin equipaje'
    };
}

/**
 * Determina si el carry on es una mochila basado en las dimensiones
 */
function isBackpackType(carryOnBagInfo: {
    quantity?: string;
    weight?: string;
    dimensions?: string;
}): boolean {
    if (!carryOnBagInfo.dimensions) return false;

    const dimensions = carryOnBagInfo.dimensions.toLowerCase();

    // Indicadores de mochila
    const backpackIndicators = [
        'mochila',
        'backpack',
        'personal item',
        'item personal',
        'bolso personal',
        'personal'
    ];

    return backpackIndicators.some(indicator => dimensions.includes(indicator));
}

/**
 * Light fare airlines (typically only include backpack/personal item)
 */
export const LIGHT_FARE_AIRLINES = ['LA', 'H2', 'AV', 'AM', 'JA', 'AR'];

/**
 * Check if airline is a light fare carrier
 */
export function isLightFareAirline(code: string): boolean {
    return LIGHT_FARE_AIRLINES.includes(code.toUpperCase());
}

/**
 * Analyzes baggage information for all legs of a flight
 * Returns per-leg baggage analysis with type detection
 */
export function analyzeBaggagePerLeg(legs: any[]): PerLegBaggageInfo[] {
    return legs.map((leg, legIndex) => {
        const legSegments = leg.Options?.[0]?.Segments || [];
        const firstSegment = legSegments[0] || {};

        const legBaggageInfo = firstSegment.Baggage || '';
        const legCarryOnInfo = firstSegment.CarryOnBagInfo;
        const legAirlineCode = firstSegment.Airline || 'N/A';

        // Parse baggage allowance for this leg
        const baggageMatch = legBaggageInfo.match(/(\d+)PC|(\d+)KG/);
        const baggageQuantity = baggageMatch ? parseInt(baggageMatch[1] || baggageMatch[2]) : 0;

        // Get carry-on info
        const carryOnQuantity = legCarryOnInfo?.Quantity || firstSegment.carryOnBagInfo?.quantity || '0';
        const carryOnWeight = legCarryOnInfo?.Weight || firstSegment.carryOnBagInfo?.weight || null;
        const carryOnDimensions = legCarryOnInfo?.Dimensions || firstSegment.carryOnBagInfo?.dimensions || null;

        // Determine baggage type for this leg
        const baggageInfo = getBaggageType(legBaggageInfo, {
            quantity: carryOnQuantity,
            weight: carryOnWeight,
            dimensions: carryOnDimensions
        });

        return {
            legNumber: legIndex + 1,
            airlineCode: legAirlineCode,
            baggageInfo: legBaggageInfo,
            baggageQuantity,
            carryOnQuantity,
            carryOnWeight,
            carryOnDimensions,
            type: baggageInfo.type
        };
    });
}

/**
 * Evaluates if a flight matches the user's luggage preference
 * Uses per-leg baggage analysis for accurate filtering
 *
 * @param baggageAnalysis - Per-leg baggage analysis array
 * @param luggagePreference - User's luggage preference
 * @returns true if the flight matches the preference
 */
export function matchesLuggagePreference(
    baggageAnalysis: PerLegBaggageInfo[],
    luggagePreference: string
): boolean {
    if (!luggagePreference || luggagePreference === 'any') {
        return true;
    }

    // Helper function to detect if carry-on is a backpack based on dimensions
    const isBackpackFromDimensions = (dimensions: string | null): boolean => {
        if (!dimensions) return false;
        const dim = dimensions.toLowerCase();
        const backpackIndicators = ['mochila', 'backpack', 'personal item', 'item personal', 'bolso personal', 'personal'];
        return backpackIndicators.some(indicator => dim.includes(indicator));
    };

    // Check EACH leg individually
    for (const leg of baggageAnalysis) {
        const legHasChecked = leg.baggageQuantity > 0;
        const legHasCarryOn = parseInt(leg.carryOnQuantity || '0') > 0;
        const legIsBackpack = isBackpackFromDimensions(leg.carryOnDimensions);
        const isLightFare = isLightFareAirline(leg.airlineCode);

        let legMatches = false;

        switch (luggagePreference) {
            case 'backpack':
                // ONLY backpack/personal item - exclude real carry-on and checked baggage
                if (legHasCarryOn && legIsBackpack && !legHasChecked) {
                    legMatches = true;
                } else if (!legHasChecked && !legHasCarryOn && isLightFare) {
                    // Light fare airline without explicit info → assume backpack only
                    legMatches = true;
                } else {
                    legMatches = false;
                }
                break;
            case 'carry_on':
                // ONLY real carry-on - exclude backpack and checked baggage
                if (legHasCarryOn && !legIsBackpack && !legHasChecked) {
                    legMatches = true;
                } else if (!legHasChecked && !legHasCarryOn && !isLightFare) {
                    // Non-light-fare airline without explicit info → assume standard carry-on
                    legMatches = true;
                } else {
                    legMatches = false;
                }
                break;
            case 'checked':
                legMatches = legHasChecked;
                break;
            case 'both':
                legMatches = legHasChecked && legHasCarryOn;
                break;
            case 'none':
                legMatches = !legHasChecked && !legHasCarryOn;
                break;
            default:
                legMatches = true;
                break;
        }

        if (!legMatches) {
            return false;
        }
    }

    return true;
}
