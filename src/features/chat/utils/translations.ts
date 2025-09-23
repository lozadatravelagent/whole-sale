// Sistema de traducciones para la UI del chat
// Mantiene consistencia en español (AR/ES neutro)

export const translations = {
    // Tipos de habitaciones
    roomTypes: {
        'SGL': 'Habitación Individual',
        'DUS': 'Habitación Doble Uso Individual',
        'DBL': 'Habitación Doble',
        'TPL': 'Habitación Triple',
        'QUA': 'Habitación Cuádruple/Familiar',
        'FAMILY': 'Habitación Familiar',
        'OTHER': 'Otras Habitaciones',
        'single': 'individual',
        'double': 'doble',
        'triple': 'triple',
        'quad': 'cuádruple',
        'family': 'familiar',
        // Traducciones específicas para EUROVIPS
        'doble ROOM FOR individual USE': 'Habitación Doble Uso Individual',
        'doble ROOM WITH A KING SIZE BED OR TWO BEDS': 'Habitación Doble con Cama King o Dos Camas',
        'confort triple ROOM': 'Habitación Triple Confort',
        'Habitación Familiar ROOM': 'Habitación Familiar'
    },

    // Equipaje
    baggage: {
        'carry on': 'equipaje de mano',
        'checked': 'equipaje facturado',
        'both': 'equipaje de mano y facturado',
        'none': 'sin equipaje'
    },

    // Tipos de vuelo
    flightTypes: {
        'one-way': 'solo ida',
        'round trip': 'ida y vuelta',
        'direct': 'vuelo directo',
        'one_stop': 'con una escala',
        'two_stops': 'con dos escalas',
        'any': 'cualquier tipo'
    },

    // Escalas y conexiones
    layovers: {
        'layover': 'escala',
        'connection': 'conexión',
        'stopover': 'escala prolongada'
    },

    // Clases de cabina
    cabinClasses: {
        'Economy': 'Económica',
        'Premium': 'Premium',
        'Business': 'Business',
        'First': 'Primera',
        'cabin': 'clase'
    },

    // Tarifas y precios
    fares: {
        'fare': 'tarifa',
        'base fare': 'tarifa base',
        'total fare': 'tarifa total',
        'net fare': 'tarifa neta'
    },

    // Servicios de habitación
    roomServices: {
        'breakfast': 'desayuno',
        'bed and breakfast': 'cama y desayuno',
        'room only': 'solo habitación',
        'all inclusive': 'todo incluido',
        'half board': 'media pensión',
        'full board': 'pensión completa',
        // Traducciones específicas para EUROVIPS
        'solo habitación': 'solo habitación',
        'individual USE': 'uso individual',
        'KING SIZE BED': 'cama king size',
        'TWO BEDS': 'dos camas',
        'OR': 'o'
    },

    // Categorías de habitación
    roomCategories: {
        'standard': 'estándar',
        'superior': 'superior',
        'executive': 'ejecutiva',
        'comfort': 'confort',
        'deluxe': 'deluxe',
        'basic': 'básica'
    },

    // Disponibilidad
    availability: {
        'available': 'disponible',
        'limited': 'disponibilidad limitada',
        'not available': 'no disponible',
        'on request': 'bajo consulta'
    }
};

// Función para traducir descripciones de habitaciones
export const translateRoomDescription = (description: string): string => {
    let translated = description;

    // Traducir frases completas primero (orden de mayor a menor longitud)
    Object.entries(translations.roomTypes).forEach(([en, es]) => {
        if (en.length > 3) { // Solo frases largas
            const regex = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            translated = translated.replace(regex, es);
        }
    });

    // Traducir servicios
    Object.entries(translations.roomServices).forEach(([en, es]) => {
        const regex = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        translated = translated.replace(regex, es);
    });

    // Traducir categorías
    Object.entries(translations.roomCategories).forEach(([en, es]) => {
        const regex = new RegExp(`\\b${en}\\b`, 'gi');
        translated = translated.replace(regex, es);
    });

    // Traducir tipos de habitación cortos al final
    Object.entries(translations.roomTypes).forEach(([en, es]) => {
        if (en.length <= 3) { // Solo códigos cortos
            const regex = new RegExp(`\\b${en}\\b`, 'gi');
            translated = translated.replace(regex, es);
        }
    });

    return translated;
};

// Función para traducir tipos de habitación en títulos
export const translateRoomTypeTitle = (type: string): string => {
    return translations.roomTypes[type as keyof typeof translations.roomTypes] || type;
};

// Función para traducir información de vuelos
export const translateFlightInfo = (text: string): string => {
    let translated = text;

    // Traducir tipos de vuelo
    Object.entries(translations.flightTypes).forEach(([en, es]) => {
        const regex = new RegExp(`\\b${en}\\b`, 'gi');
        translated = translated.replace(regex, es);
    });

    // Traducir escalas
    Object.entries(translations.layovers).forEach(([en, es]) => {
        const regex = new RegExp(`\\b${en}\\b`, 'gi');
        translated = translated.replace(regex, es);
    });

    // Traducir clases de cabina
    Object.entries(translations.cabinClasses).forEach(([en, es]) => {
        const regex = new RegExp(`\\b${en}\\b`, 'gi');
        translated = translated.replace(regex, es);
    });

    // Traducir tarifas
    Object.entries(translations.fares).forEach(([en, es]) => {
        const regex = new RegExp(`\\b${en}\\b`, 'gi');
        translated = translated.replace(regex, es);
    });

    return translated;
};

// Función para traducir equipaje
export const translateBaggage = (baggageType: string): string => {
    return translations.baggage[baggageType as keyof typeof translations.baggage] || baggageType;
};
