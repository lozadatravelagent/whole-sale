import { AirfareSearchParams } from '@/services/airfareSearch';
import { HotelSearchParams } from '@/types';
import { FlightData, HotelData } from '@/types';

export interface CombinedTravelRequest {
  flights: AirfareSearchParams;
  hotels: HotelSearchParams;
  requestType: 'combined' | 'flights-only' | 'hotels-only';
}

export interface CombinedTravelResults {
  flights: FlightData[];
  hotels: HotelData[];
  requestType: 'combined' | 'flights-only' | 'hotels-only';
}

/**
 * Detect if a message is requesting combined travel services (flights + hotels)
 */
export function isCombinedTravelMessage(messageText: string): boolean {


  const lowerMessage = messageText.toLowerCase();

  // Indicators for combined travel requests
  const combinedIndicators = [
    // Direct combined requests
    'quiero un viaje',
    'necesito vuelo y hotel',
    'quiero viajar',
    'organizar mi viaje',
    'planificar viaje',
    'package completo',
    'viaje completo',

    // Flight + hotel patterns
    'vuelo.*hotel',
    'hotel.*vuelo',
    'avión.*alojamiento',
    'alojamiento.*avión',
    'flight.*hotel',
    'hotel.*flight',

    // Specific combined requests
    'y.*hotel', // "quiero un vuelo ... y hotel"
    'también.*hotel', // "vuelo ... también hotel"
    'además.*hotel', // "vuelo ... además hotel"
    'y.*vuelo', // "hotel ... y vuelo"
    'también.*vuelo',
    'además.*vuelo'
  ];

  const hasCombinedIndicators = combinedIndicators.some(indicator => {
    if (indicator.includes('.*')) {
      // Use regex for complex patterns
      const regex = new RegExp(indicator, 'i');
      return regex.test(lowerMessage);
    }
    return lowerMessage.includes(indicator);
  });

  // Check if message contains both flight and hotel keywords
  const hasFlightKeywords = [
    'vuelo', 'flight', 'avión', 'aéreo', 'volando', 'volar'
  ].some(keyword => lowerMessage.includes(keyword));

  const hasHotelKeywords = [
    'hotel', 'alojamiento', 'hospedaje', 'quedarse', 'dormir'
  ].some(keyword => lowerMessage.includes(keyword));

  const hasBothServices = hasFlightKeywords && hasHotelKeywords;



  return hasCombinedIndicators || hasBothServices;
}

/**
 * Parse a combined travel request from user message
 */
export function parseCombinedTravelRequest(messageText: string): CombinedTravelRequest | null {


  try {
    // Extract flight parameters
    const flightParams = extractFlightParams(messageText);


    // Extract hotel parameters  
    const hotelParams = extractHotelParams(messageText);


    // Determine request type
    const hasValidFlightParams = flightParams.origin && flightParams.destination && flightParams.departureDate;
    const hasValidHotelParams = hotelParams.city && hotelParams.dateFrom && hotelParams.dateTo;

    let requestType: 'combined' | 'flights-only' | 'hotels-only';

    if (hasValidFlightParams && hasValidHotelParams) {
      requestType = 'combined';
    } else if (hasValidFlightParams) {
      requestType = 'flights-only';
    } else if (hasValidHotelParams) {
      requestType = 'hotels-only';
    } else {

      return null;
    }

    return {
      flights: flightParams,
      hotels: hotelParams,
      requestType
    };

  } catch (error) {
    console.error('❌ Error parsing combined travel request:', error);
    return null;
  }
}

function extractFlightParams(message: string): AirfareSearchParams {
  const lowerMessage = message.toLowerCase();

  // Prefer IATA codes in parentheses when present
  // Example: "desde Bogotá (BOG) a Punta Cana (PUJ)"
  let origin = '';
  let destination = '';
  const iataMatches = Array.from(message.matchAll(/\(([A-Z]{3})\)/g)).map(m => m[1]);
  if (iataMatches.length >= 2) {
    origin = iataMatches[0];
    destination = iataMatches[1];
  }

  // If IATA not found, try a strict "desde X a Y" capture to avoid "ida y vuelta"
  if (!origin || !destination) {
    const odStrict = message.match(/(?:desde|from|de)\s+([a-záéíóúñ\s]+?)\s+(?:a|to|hacia|para)\s+([a-záéíóúñ\s]+?)(?=\s+(?:saliendo|el|desde|departure|return|con|y|,|\.|$))/i);
    if (odStrict) {
      origin = origin || odStrict[1].trim();
      destination = destination || odStrict[2].trim();
    }
  }

  // As a last resort, reuse broader patterns but guard against capturing "y vuelta"
  if (!origin) {
    const originPatterns = [
      /(?:desde|from|de)\s+([a-záéíóúñ\s]+?)(?=\s+(?:a|to|hacia|para)\b)/i,
      /(?:saliendo|partiendo|departure)\s+(?:de|from)?\s*([a-záéíóúñ\s]+?)(?=\s+(?:a|to|hacia|para)\b|$)/i
    ];
    for (const pattern of originPatterns) {
      const match = message.match(pattern);
      if (match) {
        origin = match[1].trim();
        break;
      }
    }
  }

  if (!destination) {
    // Take the last valid " a <dest> " occurrence to avoid the earlier "ida y vuelta"
    const destMatches = Array.from(message.matchAll(/\s+(?:a|to|hacia|para)\s+([a-záéíóúñ\s]+?)(?=\s+(?:saliendo|el|desde|departure|return|con|y|,|\.|$))/gi));
    if (destMatches.length > 0) {
      destination = destMatches[destMatches.length - 1][1].trim();
    }
  }

  // Cleanup: remove trailing parenthetical codes from names if any
  const cleanupLocation = (text: string) => text.replace(/\s*\([A-Z]{3}\)\s*/g, '').trim();
  if (origin && !/^\w{3}$/.test(origin)) origin = cleanupLocation(origin);
  if (destination && !/^\w{3}$/.test(destination)) destination = cleanupLocation(destination);

  // Guard against accidental capture like "y vuelta"
  if (/\b(vuelta|ida)\b/i.test(destination)) {
    const destMatches = Array.from(message.matchAll(/\s+(?:a|to|hacia|para)\s+([a-záéíóúñ\s]+?)(?=\s+(?:saliendo|el|desde|departure|return|con|y|,|\.|$))/gi));
    const valid = destMatches.map(m => m[1].trim()).filter(d => !/\b(vuelta|ida)\b/i.test(d));
    if (valid.length > 0) destination = valid[valid.length - 1];
  }

  // Extract departure date - including month + duration patterns
  const departureDatePatterns = [
    /saliendo\s+(?:el\s+)?(\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4})/i,
    /saliendo\s+(?:el\s+)?(\d{4}-\d{2}-\d{2})/i,
    /departure[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /(\d{1,2}[\\/\\-]\d{1,2}[\\/\\-]\d{4})/i,
    // Month + duration patterns for travel dates
    /en\s+([a-záéíóúñ]+)\s+durante\s+(\d+)\s+noches?/i,
    /([a-záéíóúñ]+)\s+durante\s+(\d+)\s+noches?/i,
    /durante\s+(\d+)\s+noches?\s+en\s+([a-záéíóúñ]+)/i
  ];

  let departureDate = '';
  let returnDate = '';

  for (const pattern of departureDatePatterns) {
    const match = message.match(pattern);
    if (match) {
      if (match[2] && /noches?/i.test(match[0])) {
        // Month + duration pattern: "abril durante 8 noches"
        const monthName = match[1].toLowerCase();
        const nights = parseInt(match[2]);

        const spanishMonths: Record<string, string> = {
          'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
          'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
          'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        };

        const monthNumber = spanishMonths[monthName];
        if (monthNumber) {
          // Use first day of the month for current year
          const currentYear = new Date().getFullYear();
          const nextYear = currentYear + 1;

          // If month has passed this year, use next year
          const currentMonth = new Date().getMonth() + 1;
          const targetYear = parseInt(monthNumber) <= currentMonth ? nextYear : currentYear;

          departureDate = `${targetYear}-${monthNumber}-01`;

          // Calculate return date
          const depDate = new Date(departureDate);
          depDate.setDate(depDate.getDate() + nights);
          returnDate = depDate.toISOString().split('T')[0];
        }
        break;
      } else {
        departureDate = normalizeDateString(match[1]);
        break;
      }
    }
  }

  // Extract return date only if not already set by duration pattern
  if (!returnDate) {
    const returnDatePatterns = [
      /(?:con\s+)?(?:vuelta|regreso|return)\s+(?:el\s+)?(\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4})/i,
      /(?:con\s+)?(?:vuelta|regreso|return)\s+(?:el\s+)?(\d{4}-\d{2}-\d{2})/i,
      /return[:\s]+(\d{4}-\d{2}-\d{2})/i
    ];

    for (const pattern of returnDatePatterns) {
      const match = message.match(pattern);
      if (match) {
        returnDate = normalizeDateString(match[1]);
        break;
      }
    }
  }

  // Extract passenger counts
  const adultsMatch = message.match(/(\d+)\s*adult[os]?/i);
  const childrenMatch = message.match(/(\d+)\s*(?:niño[s]?|child(?:ren)?)/i);

  const adults = adultsMatch ? parseInt(adultsMatch[1]) : 1;
  const children = childrenMatch ? parseInt(childrenMatch[1]) : 0;

  // Use default dates if not specified
  if (!departureDate) {
    const today = new Date();
    today.setDate(today.getDate() + 7); // Default to 7 days from now
    departureDate = today.toISOString().split('T')[0];
  }

  if (!returnDate && (message.includes('vuelta') || message.includes('return') || message.includes('regreso'))) {
    const depDate = new Date(departureDate);
    depDate.setDate(depDate.getDate() + 7); // Default 7 day trip
    returnDate = depDate.toISOString().split('T')[0];
  }

  return {
    origin: origin,
    destination: destination,
    departureDate,
    returnDate: returnDate || undefined,
    adults,
    children
  };
}

function extractHotelParams(message: string): HotelSearchParams {
  // Extract hotel name
  const hotelNamePatterns = [
    /hotel\s+([a-záéíóúñ\s]+?)(?:\s+(?:en|desde|del|para)|$)/i,
    /(?:en\s+el\s+)?hotel\s+([a-záéíóúñ\s]+)/i
  ];

  let hotelName = '';
  for (const pattern of hotelNamePatterns) {
    const match = message.match(pattern);
    if (match) {
      hotelName = match[1].trim();
      break;
    }
  }

  // Extract city for hotel (can be same as flight destination)
  const cityPatterns = [
    // Specific pattern for "hoteles en [ciudad] para la misma fecha"
    /hoteles?\s+en\s+([a-záéíóúñ\s]+?)\s+para\s+la\s+misma\s+fecha/i,
    // General hotel city patterns - more careful with "para"
    /(?:hotel\s+)?(?:en|in)\s+([a-záéíóúñ\s]+?)(?:\s+(?:desde|del|para\s+(?!la\s+misma)|saliendo|departure)|$)/i,
    /(?:alojamiento|hospedaje)\s+(?:en|in)?\s*([a-záéíóúñ\s]+?)(?:\s+para\s+(?!la\s+misma)|$)/i
  ];

  let city = '';
  for (const pattern of cityPatterns) {
    const match = message.match(pattern);
    if (match) {
      city = match[1].trim();
      break;
    }
  }

  // Extract hotel dates (usually same as flight dates or inferred)
  const checkInPatterns = [
    /(?:hotel\s+)?(?:desde|from|check.*in)\s+(?:el\s+)?(\d{4}-\d{2}-\d{2})/i,
    /(?:llegada|arrival)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /desde\s+(?:el\s+)?(\d{1,2})\s+de\s+([a-záéíóú]+)/i,
    /desde\s+(?:el\s+)?(\d{1,2})[\\/\\-](\d{1,2})[\\/\\-](\d{4})/i,
    /(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+(\d{4}))?/i
  ];

  const checkOutPatterns = [
    /(?:hasta|until|check.*out)\s+(?:el\s+)?(\d{4}-\d{2}-\d{2})/i,
    /(?:salida|departure)[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /hasta\s+(?:el\s+)?(\d{1,2})\s+de\s+([a-záéíóú]+)/i,
    /hasta\s+(?:el\s+)?(\d{1,2})[\\/\\-](\d{1,2})[\\/\\-](\d{4})/i,
    /al\s+(\d{1,2})\s+de\s+([a-záéíóú]+)/i
  ];

  let dateFrom = '';
  let dateTo = '';

  for (const pattern of checkInPatterns) {
    const match = message.match(pattern);
    if (match) {
      if (match[2] && match[3]) {
        // Format: dd de mes de yyyy
        dateFrom = normalizeDateString(`${match[1]} de ${match[2]} de ${match[3] || new Date().getFullYear()}`);
      } else if (match[2]) {
        // Format: dd de mes (current year assumed) or dd/mm/yyyy
        if (match[3]) {
          // dd/mm/yyyy format
          dateFrom = normalizeDateString(`${match[1]}/${match[2]}/${match[3]}`);
        } else {
          // dd de mes format
          dateFrom = normalizeDateString(`${match[1]} de ${match[2]} de ${new Date().getFullYear()}`);
        }
      } else {
        // YYYY-MM-DD format
        dateFrom = normalizeDateString(match[1]);
      }
      break;
    }
  }

  for (const pattern of checkOutPatterns) {
    const match = message.match(pattern);
    if (match) {
      if (match[2] && match[3]) {
        // Format: dd de mes de yyyy
        dateTo = normalizeDateString(`${match[1]} de ${match[2]} de ${match[3] || new Date().getFullYear()}`);
      } else if (match[2]) {
        // Format: dd de mes (current year assumed) or dd/mm/yyyy
        if (match[3]) {
          // dd/mm/yyyy format
          dateTo = normalizeDateString(`${match[1]}/${match[2]}/${match[3]}`);
        } else {
          // dd de mes format
          dateTo = normalizeDateString(`${match[1]} de ${match[2]} de ${new Date().getFullYear()}`);
        }
      } else {
        // YYYY-MM-DD format
        dateTo = normalizeDateString(match[1]);
      }
      break;
    }
  }

  // If no hotel dates specified, try to infer from flight dates in the same message
  if (!dateFrom || !dateTo) {
    // Try to extract month + duration patterns first
    const durationPatterns = [
      /en\s+([a-záéíóúñ]+)\s+durante\s+(\d+)\s+noches?/i,
      /([a-záéíóúñ]+)\s+durante\s+(\d+)\s+noches?/i,
      /durante\s+(\d+)\s+noches?\s+en\s+([a-záéíóúñ]+)/i
    ];

    let foundDuration = false;
    for (const pattern of durationPatterns) {
      const match = message.match(pattern);
      if (match && match[2]) {
        const monthName = match[1].toLowerCase();
        const nights = parseInt(match[2]);

        const spanishMonths: Record<string, string> = {
          'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
          'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
          'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
        };

        const monthNumber = spanishMonths[monthName];
        if (monthNumber) {
          const currentYear = new Date().getFullYear();
          const nextYear = currentYear + 1;
          const currentMonth = new Date().getMonth() + 1;
          const targetYear = parseInt(monthNumber) <= currentMonth ? nextYear : currentYear;

          dateFrom = `${targetYear}-${monthNumber}-01`;

          const depDate = new Date(dateFrom);
          depDate.setDate(depDate.getDate() + nights);
          dateTo = depDate.toISOString().split('T')[0];
          foundDuration = true;
          break;
        }
      }
    }

    // If duration pattern not found, try standard date patterns
    if (!foundDuration) {
      const flightDeparture = message.match(/saliendo\s+(?:el\s+)?(\d{4}-\d{2}-\d{2})/i);
      const flightReturn = message.match(/(?:vuelta|regreso)\s+(?:el\s+)?(\d{4}-\d{2}-\d{2})/i);

      if (flightDeparture) {
        dateFrom = normalizeDateString(flightDeparture[1]);
      }
      if (flightReturn) {
        dateTo = normalizeDateString(flightReturn[1]);
      }
    }
  }

  // Use default dates if still not specified
  if (!dateFrom || !dateTo) {
    const today = new Date();
    today.setDate(today.getDate() + 7);
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 3);

    dateFrom = today.toISOString().split('T')[0];
    dateTo = futureDate.toISOString().split('T')[0];
  }

  // Ensure checkout is after checkin
  const checkInDate = new Date(dateFrom);
  const checkOutDate = new Date(dateTo);

  if (checkOutDate <= checkInDate) {
    const adjustedCheckOut = new Date(checkInDate);
    adjustedCheckOut.setDate(checkInDate.getDate() + 1);
    dateTo = adjustedCheckOut.toISOString().split('T')[0];
  }

  return {
    dateFrom,
    dateTo,
    city: city || 'Madrid', // Default to same as flight destination or fallback
    hotelName: hotelName || undefined
  };
}

function normalizeDateString(dateStr: string): string {
  // Convert various date formats to YYYY-MM-DD

  // Handle Spanish date format: "1 de julio de 2026"
  const spanishMonths: Record<string, string> = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };

  const spanishDateMatch = dateStr.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
  if (spanishDateMatch) {
    const day = spanishDateMatch[1].padStart(2, '0');
    const month = spanishMonths[spanishDateMatch[2].toLowerCase()] || '01';
    const year = spanishDateMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = dateStr.match(/(\d{1,2})[\\/\\-](\d{1,2})[\\/\\-](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, '0');
    const month = ddmmyyyyMatch[2].padStart(2, '0');
    const year = ddmmyyyyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Fallback: try to parse and convert
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.warn('⚠️ Could not parse date:', dateStr);
  }

  // Final fallback: return today
  return new Date().toISOString().split('T')[0];
}

/**
 * Generate example prompts for testing combined travel requests
 */
export function getExampleCombinedTravelPrompts(): string[] {
  return [
    "Quiero un viaje de Buenos Aires a Madrid saliendo el 1 de Julio de 2026 con vuelta el 1 de Agosto de 2026 y quiero un hotel",
    "Necesito vuelo y hotel para viajar de Buenos Aires a Barcelona desde el 15 de diciembre hasta el 22 de diciembre",
    "Organizar mi viaje completo: vuelo desde Ezeiza a Paris y alojamiento en hotel por 5 días",
    "Quiero volar a Roma y también necesito hotel desde el 10 de enero hasta el 17 de enero de 2026",
    "Planificar viaje a Londres: avión ida y vuelta más hospedaje para 2 adultos",
    "Package completo Buenos Aires - Miami: vuelo + hotel del 5 al 12 de marzo 2026"
  ];
}