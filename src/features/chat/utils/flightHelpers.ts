// ═══════════════════════════════════════════════════════════════════════════════
// Flight Helpers - Utilities for flight data transformation and display
// ═══════════════════════════════════════════════════════════════════════════════

// Centralized imports
import { getCityNameFromIATA } from '@/services/cityCodeService';
import {
  getAirlineName as getAirlineNameFromAliases,
  getAirlineCode,
  AIRLINE_ALIASES
} from '@/features/chat/data/airlineAliases';

// Helper function to format duration from minutes to readable format
export const formatDuration = (minutes: number): string => {
  if (!minutes || minutes <= 0) return '0h 0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

// Helper function to get city name from airport code
// Now uses centralized service with 500+ airport mappings
export const getCityNameFromCode = getCityNameFromIATA;

// Helper function to get tax description from tax code
export const getTaxDescription = (taxCode: string): string => {
  const taxDescriptions: Record<string, string> = {
    'AR': 'Tasa de Salida Argentina',
    'Q1': 'Tasa de Combustible',
    'QO': 'Tasa de Operación',
    'TQ': 'Tasa de Terminal',
    'XY': 'Tasa de Inmigración',
    'YC': 'Tasa de Seguridad',
    'S7': 'Tasa de Servicio',
    'XR': 'Tasa de Inspección',
    'XA': 'Tasa de Aduanas',
    'XF': 'Tasa de Facilidades',
    'UX': 'Tasa de Uso',
    'L8': 'Tasa Local',
    'VB': 'Tasa Variable',
    'AY': 'Tasa de Aeropuerto',
    'TY': 'Tasa de Turismo'
  };

  return taxDescriptions[taxCode] || `Tasa ${taxCode}`;
};

// Helper function to get airline name from airline code
// Uses centralized airline aliases for consistency across the system
export const getAirlineNameFromCode = (airlineCode: string): string => {
  return getAirlineNameFromAliases(airlineCode);
};

// Helper function to get airline code from airline name (reverse mapping)
// Uses centralized airline aliases for consistency across the system

export const getAirlineCodeFromName = (airlineName: string): string => {
  const normalizedName = airlineName.toLowerCase().trim();

  // Try exact match first using centralized aliases
  const exactMatch = getAirlineCode(airlineName);
  if (exactMatch) {
    return exactMatch;
  }

  // Try partial matches for common variations
  for (const [name, code] of Object.entries(AIRLINE_ALIASES)) {
    if (normalizedName.includes(name) || name.includes(normalizedName)) {
      return code;
    }
  }

  // If no match found, return the original name (uppercase for consistency)
  return airlineName.toUpperCase();
};

// Helper function to check if airline matches preference (supports both codes and names)
export const matchesAirlinePreference = (airlineCode: string, operatingAirlineName: string | null, preference: string): boolean => {
  if (!preference) return true;

  const normalizedPreference = preference.toLowerCase().trim();
  const normalizedCode = airlineCode.toLowerCase();
  const normalizedOperatingName = operatingAirlineName?.toLowerCase() || '';

  // Check if preference is already a code (2-3 characters)
  if (preference.length <= 3 && preference.toUpperCase() === airlineCode) {
    return true;
  }

  // Check if preference matches the operating airline name
  if (operatingAirlineName && normalizedOperatingName.includes(normalizedPreference)) {
    return true;
  }

  // Check if preference matches mapped airline name
  const mappedName = getAirlineNameFromCode(airlineCode).toLowerCase();
  if (mappedName.includes(normalizedPreference)) {
    return true;
  }

  // Try to convert preference to code and compare
  const preferenceAsCode = getAirlineCodeFromName(preference);
  if (preferenceAsCode === airlineCode) {
    return true;
  }

  return false;
};

// Helper function to calculate connection time between segments
export const calculateConnectionTime = (segment1: any, segment2: any): string => {
  if (!segment1?.Arrival?.Date || !segment1?.Arrival?.Time ||
    !segment2?.Departure?.Date || !segment2?.Departure?.Time) {
    return 'N/A';
  }

  try {
    const arrival = new Date(`${segment1.Arrival.Date}T${segment1.Arrival.Time}`);
    const departure = new Date(`${segment2.Departure.Date}T${segment2.Departure.Time}`);

    const diffMs = departure.getTime() - arrival.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 0) return 'N/A';

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  } catch (error) {
    console.warn('Error calculating connection time:', error);
    return 'N/A';
  }
};