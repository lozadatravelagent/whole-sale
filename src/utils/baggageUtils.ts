export type BaggageType = 'checked' | 'carryon' | 'backpack' | 'checked-plus-carryon' | 'unspecified-carryon' | 'none';

export interface BaggageInfo {
    type: BaggageType;
    description: string;
    details?: string;
    checkedPieces?: number;
    hasCarryOn?: boolean;
    carryOnSpecified?: boolean;
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
 * Obtiene el icono correspondiente al tipo de equipaje
 */
export function getBaggageIcon(type: BaggageType): string {
    switch (type) {
        case 'checked':
            return 'luggage';
        case 'carryon':
            return 'briefcase';
        case 'backpack':
            return 'backpack';
        case 'checked-plus-carryon':
            return 'luggage'; // Usar icono de valija como principal
        case 'unspecified-carryon':
            return 'help-circle'; // Icono de interrogación para "no especificado"
        case 'none':
            return 'x';
        default:
            return 'x';
    }
}
