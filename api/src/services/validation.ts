/**
 * Validation helper for API Search Edge Function
 *
 * Validates required fields for different request types
 * Based on src/services/aiMessageParser.ts validation logic
 */

import type { ParsedRequest } from './contextManagement';

export interface ValidationResult {
  isValid: boolean;
  message: string;
  missingFields: Array<{
    field: string;
    description: string;
    examples: string[];
  }>;
}

/**
 * Validates that required fields are present for each request type
 */
export function validateParsedRequest(parsed: ParsedRequest): ValidationResult {
  switch (parsed.type) {
    case 'flights':
      return validateFlightRequiredFields(parsed);

    case 'hotels':
      return validateHotelRequiredFields(parsed);

    case 'combined':
      // Validate both flights and hotels
      const flightValidation = validateFlightRequiredFields(parsed);
      if (!flightValidation.isValid) {
        return flightValidation;
      }
      return validateHotelRequiredFields(parsed);

    case 'packages':
      return validatePackageRequiredFields(parsed);

    case 'services':
      return validateServiceRequiredFields(parsed);

    case 'itinerary':
      return validateItineraryRequiredFields(parsed);

    default:
      return {
        isValid: true,
        message: '',
        missingFields: []
      };
  }
}

/**
 * Validate flight required fields
 * REQUIRED: origin, destination, departureDate, adults
 * OPTIONAL: returnDate, luggage, stops, preferredAirline, maxLayoverHours
 */
function validateFlightRequiredFields(parsed: ParsedRequest): ValidationResult {
  if (!parsed.flights) {
    return {
      isValid: false,
      message: 'Para buscar vuelos necesito más información',
      missingFields: [
        {
          field: 'origin',
          description: '¿Desde dónde quieres viajar?',
          examples: ['Buenos Aires', 'Ezeiza', 'EZE']
        },
        {
          field: 'destination',
          description: '¿A dónde quieres viajar?',
          examples: ['Miami', 'Madrid', 'Cancún']
        },
        {
          field: 'departureDate',
          description: '¿Cuándo quieres viajar?',
          examples: ['15 de diciembre', '2025-12-15']
        }
      ]
    };
  }

  const missing: Array<{ field: string; description: string; examples: string[] }> = [];

  if (!parsed.flights.origin) {
    missing.push({
      field: 'origin',
      description: '¿Desde dónde quieres viajar?',
      examples: ['Buenos Aires', 'Ezeiza', 'EZE']
    });
  }

  if (!parsed.flights.destination) {
    missing.push({
      field: 'destination',
      description: '¿A dónde quieres viajar?',
      examples: ['Miami', 'Madrid', 'Cancún']
    });
  }

  if (!parsed.flights.departureDate) {
    missing.push({
      field: 'departureDate',
      description: '¿Cuándo quieres viajar?',
      examples: ['15 de diciembre', '2025-12-15', 'próximo mes']
    });
  }

  // Adults defaults to 1 if not specified, so only validate if explicitly 0 or missing
  if (!parsed.flights.adults || parsed.flights.adults < 1) {
    missing.push({
      field: 'adults',
      description: '¿Cuántos pasajeros viajan?',
      examples: ['1 adulto', '2 personas', '3 adultos']
    });
  }

  if (missing.length > 0) {
    return {
      isValid: false,
      message: 'Para buscar vuelos necesito más información',
      missingFields: missing
    };
  }

  return {
    isValid: true,
    message: '',
    missingFields: []
  };
}

/**
 * Validate hotel required fields
 * REQUIRED: city, checkinDate, checkoutDate, adults
 * OPTIONAL: roomType, mealPlan, hotelChain, hotelName
 */
function validateHotelRequiredFields(parsed: ParsedRequest): ValidationResult {
  if (!parsed.hotels) {
    return {
      isValid: false,
      message: 'Para buscar hoteles necesito más información',
      missingFields: [
        {
          field: 'city',
          description: '¿En qué ciudad quieres hospedarte?',
          examples: ['Punta Cana', 'Cancún', 'Miami']
        },
        {
          field: 'checkinDate',
          description: '¿Cuándo haces check-in?',
          examples: ['15 de diciembre', '2025-12-15']
        },
        {
          field: 'checkoutDate',
          description: '¿Cuándo haces check-out?',
          examples: ['20 de diciembre', '2025-12-20']
        }
      ]
    };
  }

  const missing: Array<{ field: string; description: string; examples: string[] }> = [];

  if (!parsed.hotels.city) {
    missing.push({
      field: 'city',
      description: '¿En qué ciudad quieres hospedarte?',
      examples: ['Punta Cana', 'Cancún', 'Miami']
    });
  }

  if (!parsed.hotels.checkinDate) {
    missing.push({
      field: 'checkinDate',
      description: '¿Cuándo haces check-in?',
      examples: ['15 de diciembre', '2025-12-15']
    });
  }

  if (!parsed.hotels.checkoutDate) {
    missing.push({
      field: 'checkoutDate',
      description: '¿Cuándo haces check-out?',
      examples: ['20 de diciembre', '2025-12-20', '5 noches después']
    });
  }

  if (!parsed.hotels.adults || parsed.hotels.adults < 1) {
    missing.push({
      field: 'adults',
      description: '¿Cuántos huéspedes adultos?',
      examples: ['1 adulto', '2 personas', '3 adultos']
    });
  }

  // NOTE: roomType and mealPlan are OPTIONAL - do NOT validate

  if (missing.length > 0) {
    return {
      isValid: false,
      message: 'Para buscar hoteles necesito más información',
      missingFields: missing
    };
  }

  return {
    isValid: true,
    message: '',
    missingFields: []
  };
}

/**
 * Validate package required fields
 */
function validatePackageRequiredFields(parsed: ParsedRequest): ValidationResult {
  if (!parsed.packages) {
    return {
      isValid: false,
      message: 'Para buscar paquetes necesito más información',
      missingFields: [
        {
          field: 'destination',
          description: '¿A qué destino quieres viajar?',
          examples: ['Punta Cana', 'Cancún', 'Caribe']
        },
        {
          field: 'dateFrom',
          description: '¿Desde cuándo?',
          examples: ['15 de diciembre', '2025-12-15']
        },
        {
          field: 'dateTo',
          description: '¿Hasta cuándo?',
          examples: ['20 de diciembre', '2025-12-20']
        }
      ]
    };
  }

  const missing: Array<{ field: string; description: string; examples: string[] }> = [];

  if (!parsed.packages.destination) {
    missing.push({
      field: 'destination',
      description: '¿A qué destino quieres viajar?',
      examples: ['Punta Cana', 'Cancún', 'Caribe']
    });
  }

  if (!parsed.packages.dateFrom) {
    missing.push({
      field: 'dateFrom',
      description: '¿Desde cuándo?',
      examples: ['15 de diciembre', '2025-12-15']
    });
  }

  if (!parsed.packages.dateTo) {
    missing.push({
      field: 'dateTo',
      description: '¿Hasta cuándo?',
      examples: ['20 de diciembre', '2025-12-20']
    });
  }

  if (missing.length > 0) {
    return {
      isValid: false,
      message: 'Para buscar paquetes necesito más información',
      missingFields: missing
    };
  }

  return {
    isValid: true,
    message: '',
    missingFields: []
  };
}

/**
 * Validate service required fields
 */
function validateServiceRequiredFields(parsed: ParsedRequest): ValidationResult {
  if (!parsed.services) {
    return {
      isValid: false,
      message: 'Para buscar servicios necesito más información',
      missingFields: [
        {
          field: 'city',
          description: '¿En qué ciudad necesitas el servicio?',
          examples: ['Miami', 'Cancún', 'Punta Cana']
        },
        {
          field: 'dateFrom',
          description: '¿Para qué fecha?',
          examples: ['15 de diciembre', '2025-12-15']
        }
      ]
    };
  }

  const missing: Array<{ field: string; description: string; examples: string[] }> = [];

  if (!parsed.services.city) {
    missing.push({
      field: 'city',
      description: '¿En qué ciudad necesitas el servicio?',
      examples: ['Miami', 'Cancún', 'Punta Cana']
    });
  }

  if (!parsed.services.dateFrom) {
    missing.push({
      field: 'dateFrom',
      description: '¿Para qué fecha?',
      examples: ['15 de diciembre', '2025-12-15']
    });
  }

  if (missing.length > 0) {
    return {
      isValid: false,
      message: 'Para buscar servicios necesito más información',
      missingFields: missing
    };
  }

  return {
    isValid: true,
    message: '',
    missingFields: []
  };
}

/**
 * Validate itinerary required fields
 */
function validateItineraryRequiredFields(parsed: ParsedRequest): ValidationResult {
  if (!parsed.itinerary) {
    return {
      isValid: false,
      message: 'Para crear un itinerario necesito más información',
      missingFields: [
        {
          field: 'destinations',
          description: '¿A qué destino(s) quieres viajar?',
          examples: ['Roma', 'París y Londres', 'Italia']
        },
        {
          field: 'days',
          description: '¿Cuántos días durará el viaje?',
          examples: ['5 días', '1 semana', '10 días']
        }
      ]
    };
  }

  const missing: Array<{ field: string; description: string; examples: string[] }> = [];

  if (!parsed.itinerary.destinations || parsed.itinerary.destinations.length === 0) {
    missing.push({
      field: 'destinations',
      description: '¿A qué destino(s) quieres viajar?',
      examples: ['Roma', 'París y Londres', 'Italia']
    });
  }

  if (!parsed.itinerary.days || parsed.itinerary.days < 1) {
    missing.push({
      field: 'days',
      description: '¿Cuántos días durará el viaje?',
      examples: ['5 días', '1 semana', '10 días']
    });
  }

  if (missing.length > 0) {
    return {
      isValid: false,
      message: 'Para crear un itinerario necesito más información',
      missingFields: missing
    };
  }

  return {
    isValid: true,
    message: '',
    missingFields: []
  };
}
