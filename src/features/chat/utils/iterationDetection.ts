/**
 * Iteration Detection Module
 * 
 * Detecta si un mensaje del usuario es una iteración sobre una búsqueda anterior
 * y determina cómo combinar el contexto previo con la nueva solicitud.
 * 
 * FLUJO:
 * 1. Usuario hace búsqueda inicial (ej: vuelo + hotel a Punta Cana)
 * 2. Sistema guarda ContextState con requestType, flightsParams, hotelsParams
 * 3. Usuario dice "quiero la misma búsqueda pero con hotel RIU"
 * 4. detectIterationIntent() detecta que es iteración de hotel sobre combined
 * 5. mergeIterationContext() preserva vuelo y actualiza solo el filtro de hotel
 * 6. Se ejecuta búsqueda combined con los parámetros mergeados
 */

import type { ContextState, FlightContextParams, HotelContextParams } from '../types/contextState';
import type { ParsedTravelRequest } from '@/services/aiMessageParser';
import { detectAirlineInText } from '../data/airlineAliases';

/**
 * Modificaciones específicas de vuelo detectadas
 */
export interface FlightModificationDetails {
  stops?: 'direct' | 'with_stops' | 'one_stop' | 'two_stops';
  luggage?: 'backpack' | 'carry_on' | 'checked';
  airline?: string;
  departureTimePreference?: string;
  arrivalTimePreference?: string;
  maxLayoverHours?: number;
  adults?: number; // Used when adding adults after "only minors" error
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
}

/**
 * Resultado de la detección de iteración
 */
export interface IterationContext {
  /**
   * Si el mensaje es una iteración sobre contexto previo
   */
  isIteration: boolean;

  /**
   * Tipo de iteración detectada
   */
  iterationType: 'hotel_modification' | 'flight_modification' | 'filter_change' | 'full_reuse' | 'new_search';

  /**
   * Tipo de búsqueda base del contexto anterior
   */
  baseRequestType: 'flights' | 'hotels' | 'combined' | null;

  /**
   * Qué componente se está modificando
   */
  modifiedComponent: 'flights' | 'hotels' | 'both' | null;

  /**
   * Campos que deben preservarse del contexto anterior
   */
  preserveFields: string[];

  /**
   * Confianza de la detección (0-1)
   */
  confidence: number;

  /**
   * Patrón que matcheó (para debug)
   */
  matchedPattern?: string;

  /**
   * Detalles de modificación de vuelo (si aplica)
   */
  flightModification?: FlightModificationDetails;
}

/**
 * Normaliza texto para comparación: lowercase, sin acentos, trimmed
 */
const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Patrones que indican referencia al contexto previo
 */
const CONTEXT_REFERENCE_PATTERNS = [
  { pattern: /\b(mism[ao]s?\s+busqueda|misma\s+consulta)\b/i, name: 'misma_busqueda' },
  { pattern: /\b(mismo\s+vuelo|mismos\s+vuelos)\b/i, name: 'mismo_vuelo' },
  { pattern: /\b(mismas?\s+fechas?)\b/i, name: 'mismas_fechas' },
  { pattern: /\b(esos?\s+vuelos?|ese\s+vuelo)\b/i, name: 'esos_vuelos' },
  { pattern: /\b(esas?\s+fechas?|esa\s+fecha)\b/i, name: 'esas_fechas' },
  { pattern: /\b(la\s+busqueda\s+anterior|busqueda\s+previa)\b/i, name: 'busqueda_anterior' },
  { pattern: /\b(como\s+antes|igual\s+que\s+antes)\b/i, name: 'como_antes' },
  { pattern: /\b(lo\s+mismo\s+pero)\b/i, name: 'lo_mismo_pero' },
  { pattern: /\b(la\s+misma\s+pero)\b/i, name: 'la_misma_pero' },
  { pattern: /\b(el\s+mismo\s+pero)\b/i, name: 'el_mismo_pero' },
];

/**
 * Patrones que indican modificación de hotel
 */
const HOTEL_MODIFICATION_PATTERNS = [
  { pattern: /\b(pero\s+con\s+hotel|pero\s+hotel)\b/i, name: 'pero_con_hotel' },
  { pattern: /\b(cambi[aáe]r?\s+(?:el\s+)?hotel)\b/i, name: 'cambiar_hotel' },
  { pattern: /\b(otro\s+hotel|diferente\s+hotel)\b/i, name: 'otro_hotel' },
  { pattern: /\b(con\s+(?:la\s+)?cadena\s+\w+)\b/i, name: 'con_cadena' },
  { pattern: /\b(hotel\s+(?:de\s+la\s+)?cadena)\b/i, name: 'hotel_cadena' },
  { pattern: /\b(en\s+(?:el\s+)?hotel\s+\w+)\b/i, name: 'en_hotel' },
  { pattern: /\b(quiero\s+(?:un\s+)?hotel\s+\w+)\b/i, name: 'quiero_hotel' },
  { pattern: /\b(prefiero\s+(?:un\s+)?hotel\s+\w+)\b/i, name: 'prefiero_hotel' },
  { pattern: /\b(cambiar\s+a\s+\w+|cambia\s+a\s+\w+)\b/i, name: 'cambiar_a' },
];

/**
 * Cadenas hoteleras conocidas para detección
 */
const KNOWN_HOTEL_CHAINS = [
  'iberostar', 'riu', 'melia', 'meliá', 'catalonia', 'bahia', 'bahía',
  'barcelo', 'barceló', 'hyatt', 'marriott', 'hilton', 'palace', 'sandals',
  'secrets', 'dreams', 'royalton', 'breathless', 'hard rock', 'excellence',
  'sunscape', 'now resorts', 'fiesta', 'oasis', 'nh', 'accor', 'wyndham'
];

/**
 * Patrones que indican nuevos parámetros de vuelo (NO es iteración de hotel)
 */
const NEW_FLIGHT_PARAMS_PATTERNS = [
  /\bdesde\s+\w+\s+(?:a|para|hasta)\s+\w+\b/i,  // origen-destino
  /\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i,  // fecha nueva
  /\b(?:vuelo|vuelos)\s+(?:desde|de|a)\s+\w+/i,  // vuelo con params
  /\bsaliendo\s+(?:el|desde)\b/i,  // saliendo de
];

/**
 * Patrones que indican modificación de vuelo (escalas, aerolínea, etc.)
 */
const FLIGHT_MODIFICATION_PATTERNS = [
  // Escalas
  { pattern: /\b(con\s+escalas?|con\s+conexion)\b/i, name: 'con_escalas', stopsValue: 'with_stops' },
  { pattern: /\b(sin\s+escalas?|vuelo\s+directo|solo\s+directo|directos?)\b/i, name: 'sin_escalas', stopsValue: 'direct' },
  { pattern: /\b(una\s+escala|1\s+escala|con\s+una\s+escala)\b/i, name: 'una_escala', stopsValue: 'one_stop' },
  { pattern: /\b(dos\s+escalas?|2\s+escalas?|con\s+dos\s+escalas?)\b/i, name: 'dos_escalas', stopsValue: 'two_stops' },
  // Aerolínea (patrones genéricos - la detección real usa detectAirlineInText)
  { pattern: /\b(otra\s+aerolinea|diferente\s+aerolinea|cambiar?\s+aerolinea)\b/i, name: 'otra_aerolinea', airlineChange: true },
  // Equipaje
  { pattern: /\b(con\s+valija|con\s+equipaje|equipaje\s+facturado)\b/i, name: 'con_equipaje', luggageValue: 'checked' },
  { pattern: /\b(sin\s+valija|solo\s+equipaje\s+de\s+mano|carry\s*on)\b/i, name: 'sin_equipaje', luggageValue: 'carry_on' },
  // ✨ Horarios de salida
  {
    pattern: /\b(que\s+)?(?:salga|sal[íi]|vuele)\s+(?:de\s+)?(?:la\s+)?(mañana|manana|tarde|noche|madrugada|dia|d[íi]a|temprano)\b/i,
    name: 'horario_salida',
    timeType: 'departure'
  },
  // ✨ Horarios de llegada
  {
    pattern: /\b(que\s+)?(?:llegue|vuelva|regrese)\s+(?:de\s+)?(?:la\s+)?(mañana|manana|tarde|noche|dia|d[íi]a)\b/i,
    name: 'horario_llegada',
    timeType: 'arrival'
  },
  // ✨ Máximo de escalas
  {
    pattern: /\bescalas?\s+(?:de\s+)?(?:no\s+)?m[aá]s\s+(?:de\s+)?(\d+)\s*(?:h|hs|hora|horas)\b/i,
    name: 'max_layover',
    extractHours: true
  },
  // ✨ Agregar adultos (después de error "solo menores")
  {
    pattern: /\b(?:agrega|agregá|suma|sumá|añade|añadí|con)\s+(\d+)\s+adultos?\b/i,
    name: 'add_adults',
    addAdultsCapture: true
  },
  // ✈️ Cabin class patterns
  {
    pattern: /\b(?:en\s+)?(?:clase\s+)?(econ[oó]mica?|economy|turista|coach|clase\s+turista)\b/i,
    name: 'cabin_economy',
    cabinClassValue: 'economy'
  },
  {
    pattern: /\b(?:en\s+)?(?:clase\s+)?(premium|premium\s+economy|econ[oó]mica\s+premium)\b/i,
    name: 'cabin_premium',
    cabinClassValue: 'premium_economy'
  },
  {
    pattern: /\b(?:en\s+)?(?:clase\s+)?(business|ejecutiva?|negocios|preferente|premium\s+business)\b/i,
    name: 'cabin_business',
    cabinClassValue: 'business'
  },
  {
    pattern: /\b(?:en\s+)?(?:clase\s+)?(primera|first|first\s+class)\b/i,
    name: 'cabin_first',
    cabinClassValue: 'first'
  },
];

/**
 * Detecta si el mensaje es una iteración sobre una búsqueda anterior
 * 
 * @param message - Mensaje del usuario
 * @param previousContext - Estado de contexto previo (de DB)
 * @returns Información sobre la iteración detectada
 */
export function detectIterationIntent(
  message: string,
  previousContext: ContextState | null
): IterationContext {
  const norm = normalizeText(message);

  // Sin contexto previo = no puede ser iteración
  if (!previousContext?.lastSearch) {
    console.log('🔍 [ITERATION] No previous context, cannot be iteration');
    return {
      isIteration: false,
      iterationType: 'new_search',
      baseRequestType: null,
      modifiedComponent: null,
      preserveFields: [],
      confidence: 1.0
    };
  }

  const { lastSearch } = previousContext;
  console.log('🔍 [ITERATION] Analyzing message for iteration patterns');
  console.log('🔍 [ITERATION] Previous search type:', lastSearch.requestType);

  // Detectar referencias al contexto previo
  let hasContextRef = false;
  let contextRefPattern = '';
  for (const { pattern, name } of CONTEXT_REFERENCE_PATTERNS) {
    if (pattern.test(norm)) {
      hasContextRef = true;
      contextRefPattern = name;
      console.log(`✅ [ITERATION] Context reference detected: "${name}"`);
      break;
    }
  }

  // Detectar modificación de hotel
  let hasHotelMod = false;
  let hotelModPattern = '';
  for (const { pattern, name } of HOTEL_MODIFICATION_PATTERNS) {
    if (pattern.test(norm)) {
      hasHotelMod = true;
      hotelModPattern = name;
      console.log(`✅ [ITERATION] Hotel modification detected: "${name}"`);
      break;
    }
  }

  // Detectar modificación de vuelo (escalas, aerolínea, equipaje, horarios, max layover, agregar adultos, cabin class)
  let hasFlightMod = false;
  let flightModPattern = '';
  let flightModDetails: {
    stopsValue?: string;
    luggageValue?: string;
    airlineChange?: boolean;
    departureTimePreference?: string;
    arrivalTimePreference?: string;
    maxLayoverHours?: number;
    adultsToAdd?: number;
    cabinClassValue?: 'economy' | 'premium_economy' | 'business' | 'first';
  } = {};
  for (const patternObj of FLIGHT_MODIFICATION_PATTERNS) {
    const { pattern, name } = patternObj;
    const stopsValue = (patternObj as any).stopsValue;
    const luggageValue = (patternObj as any).luggageValue;
    const airlineChange = (patternObj as any).airlineChange;
    const timeType = (patternObj as any).timeType;
    const extractHours = (patternObj as any).extractHours;
    const addAdultsCapture = (patternObj as any).addAdultsCapture;
    const cabinClassValue = (patternObj as any).cabinClassValue;

    const match = pattern.exec(norm);
    if (match) {
      hasFlightMod = true;
      flightModPattern = name;
      flightModDetails = { stopsValue, luggageValue, airlineChange };

      // ✨ Extraer preferencia de horario
      if (timeType === 'departure' && match[2]) {
        flightModDetails.departureTimePreference = match[2].toLowerCase();
      }
      if (timeType === 'arrival' && match[2]) {
        flightModDetails.arrivalTimePreference = match[2].toLowerCase();
      }

      // ✨ Extraer horas máximas de escala
      if (extractHours && match[1]) {
        flightModDetails.maxLayoverHours = parseInt(match[1], 10);
      }

      // ✨ Extraer cantidad de adultos a agregar (para "agrega X adultos")
      if (addAdultsCapture && match[1]) {
        flightModDetails.adultsToAdd = parseInt(match[1], 10);
        console.log(`✅ [ITERATION] Adults to add detected: ${flightModDetails.adultsToAdd}`);
      }

      // ✈️ Extraer cabin class
      if (cabinClassValue) {
        flightModDetails.cabinClassValue = cabinClassValue;
        console.log(`✅ [ITERATION] Cabin class detected: ${cabinClassValue}`);
      }

      console.log(`✅ [ITERATION] Flight modification detected: "${name}"`, flightModDetails);
      break;
    }
  }

  // Detectar mención de cadena hotelera conocida
  const mentionsHotelChain = KNOWN_HOTEL_CHAINS.some(chain =>
    norm.includes(normalizeText(chain))
  );
  if (mentionsHotelChain) {
    console.log('✅ [ITERATION] Known hotel chain mentioned');
  }

  // Detectar mención de aerolínea conocida (usa archivo centralizado)
  const detectedAirline = detectAirlineInText(message);
  const mentionsAirline = detectedAirline !== null;
  if (mentionsAirline) {
    console.log('✅ [ITERATION] Known airline mentioned:', detectedAirline?.name, '→', detectedAirline?.code);
  }

  // Detectar si hay nuevos parámetros de vuelo (origen/destino/fechas nuevas)
  const hasNewFlightParams = NEW_FLIGHT_PARAMS_PATTERNS.some(pattern => pattern.test(norm));
  if (hasNewFlightParams) {
    console.log('⚠️ [ITERATION] New flight params detected - likely NOT hotel-only iteration');
  }

  // === REGLAS DE DECISIÓN ===

  // CASO 1: "misma búsqueda pero con hotel X" sobre combined
  if (hasContextRef && hasHotelMod && !hasNewFlightParams && lastSearch.requestType === 'combined') {
    console.log('✅ [ITERATION] CASE 1: Context ref + hotel mod on combined → hotel_modification');
    return {
      isIteration: true,
      iterationType: 'hotel_modification',
      baseRequestType: 'combined',
      modifiedComponent: 'hotels',
      preserveFields: getAllFlightFields(),
      confidence: 0.95,
      matchedPattern: `${contextRefPattern} + ${hotelModPattern}`
    };
  }

  // CASO 2: Modificación de hotel sin nuevo vuelo, después de combined
  if (hasHotelMod && !hasNewFlightParams && lastSearch.requestType === 'combined') {
    console.log('✅ [ITERATION] CASE 2: Hotel mod without new flight on combined → hotel_modification');
    return {
      isIteration: true,
      iterationType: 'hotel_modification',
      baseRequestType: 'combined',
      modifiedComponent: 'hotels',
      preserveFields: getAllFlightFields(),
      confidence: 0.85,
      matchedPattern: hotelModPattern
    };
  }

  // CASO 3: Solo menciona cadena hotelera sin params de vuelo, después de combined
  if (mentionsHotelChain && !hasNewFlightParams && lastSearch.requestType === 'combined') {
    // Verificar que no sea una búsqueda completamente nueva
    const seemsLikeNewSearch = /\bquiero\s+(?:un\s+)?(?:vuelo|viaje|paquete)\b/i.test(norm);
    if (!seemsLikeNewSearch) {
      console.log('✅ [ITERATION] CASE 3: Hotel chain mention without flight params on combined → hotel_modification');
      return {
        isIteration: true,
        iterationType: 'hotel_modification',
        baseRequestType: 'combined',
        modifiedComponent: 'hotels',
        preserveFields: getAllFlightFields(),
        confidence: 0.75,
        matchedPattern: 'hotel_chain_mention'
      };
    }
  }

  // CASO 4: "lo mismo pero..." genérico
  if (/\b(lo\s+mismo\s+pero|la\s+misma\s+pero)\b/i.test(norm)) {
    // Detectar qué se quiere cambiar
    if (hasHotelMod || mentionsHotelChain) {
      console.log('✅ [ITERATION] CASE 4: "lo mismo pero" with hotel change → hotel_modification');
      return {
        isIteration: true,
        iterationType: 'hotel_modification',
        baseRequestType: lastSearch.requestType,
        modifiedComponent: 'hotels',
        preserveFields: getAllFlightFields(),
        confidence: 0.9,
        matchedPattern: 'lo_mismo_pero_hotel'
      };
    }
    // Si no especifica qué cambiar, asumir reutilización completa
    console.log('✅ [ITERATION] CASE 4b: "lo mismo pero" without specific change → full_reuse');
    return {
      isIteration: true,
      iterationType: 'full_reuse',
      baseRequestType: lastSearch.requestType,
      modifiedComponent: null,
      preserveFields: [...getAllFlightFields(), ...getAllHotelFields()],
      confidence: 0.7,
      matchedPattern: 'lo_mismo_pero'
    };
  }

  // CASO 5: "mismo vuelo" + algo de hotel
  if (/\bmismo\s+vuelo\b/i.test(norm) && (hasHotelMod || mentionsHotelChain)) {
    console.log('✅ [ITERATION] CASE 5: "mismo vuelo" with hotel change → hotel_modification');
    return {
      isIteration: true,
      iterationType: 'hotel_modification',
      baseRequestType: 'combined',
      modifiedComponent: 'hotels',
      preserveFields: getAllFlightFields(),
      confidence: 0.9,
      matchedPattern: 'mismo_vuelo_hotel'
    };
  }

  // CASO 6: Referencia a fechas anteriores + hotel
  if (hasContextRef && (hasHotelMod || mentionsHotelChain) && lastSearch.requestType !== 'hotels') {
    console.log('✅ [ITERATION] CASE 6: Context ref with hotel on non-hotel search → hotel_modification');
    return {
      isIteration: true,
      iterationType: 'hotel_modification',
      baseRequestType: lastSearch.requestType,
      modifiedComponent: 'hotels',
      preserveFields: getAllFlightFields(),
      confidence: 0.8,
      matchedPattern: `${contextRefPattern}_hotel`
    };
  }

  // ========== CASOS DE ITERACIÓN DE VUELO ==========

  // CASO 7: Modificación de escalas (con escalas, sin escalas, directo, etc.)
  if (hasFlightMod && flightModDetails.stopsValue && !hasNewFlightParams) {
    // Puede ser sobre vuelo solo o sobre combined (manteniendo hotel si había)
    const baseType = lastSearch.requestType;
    const preserveHotel = baseType === 'combined';

    console.log(`✅ [ITERATION] CASE 7: Flight stops modification → flight_modification (${flightModDetails.stopsValue})`);
    return {
      isIteration: true,
      iterationType: 'flight_modification',
      baseRequestType: baseType,
      modifiedComponent: 'flights',
      preserveFields: preserveHotel ? getAllHotelFields() : [],
      confidence: 0.95,
      matchedPattern: flightModPattern,
      // Datos extra para el merge
      flightModification: {
        stops: flightModDetails.stopsValue
      }
    } as IterationContext & { flightModification?: { stops?: string; luggage?: string; airline?: string } };
  }

  // CASO 8: Modificación de equipaje
  if (hasFlightMod && flightModDetails.luggageValue && !hasNewFlightParams) {
    const baseType = lastSearch.requestType;
    const preserveHotel = baseType === 'combined';

    console.log(`✅ [ITERATION] CASE 8: Flight luggage modification → flight_modification (${flightModDetails.luggageValue})`);
    return {
      isIteration: true,
      iterationType: 'flight_modification',
      baseRequestType: baseType,
      modifiedComponent: 'flights',
      preserveFields: preserveHotel ? getAllHotelFields() : [],
      confidence: 0.9,
      matchedPattern: flightModPattern,
      flightModification: {
        luggage: flightModDetails.luggageValue
      }
    } as IterationContext & { flightModification?: { stops?: string; luggage?: string; airline?: string } };
  }

  // CASO 9: Cambio de aerolínea
  if ((hasFlightMod && flightModDetails.airlineChange) || mentionsAirline) {
    // Si menciona aerolínea pero no hay nuevos params de vuelo, es iteración
    if (!hasNewFlightParams && (lastSearch.requestType === 'flights' || lastSearch.requestType === 'combined')) {
      const baseType = lastSearch.requestType;
      const preserveHotel = baseType === 'combined';

      // Usar aerolínea detectada por detectAirlineInText (archivo centralizado)
      const airlineCode = detectedAirline?.code;
      const airlineName = detectedAirline?.name;

      console.log(`✅ [ITERATION] CASE 9: Flight airline change → flight_modification (${airlineName || 'unknown'} → ${airlineCode || '?'})`);
      return {
        isIteration: true,
        iterationType: 'flight_modification',
        baseRequestType: baseType,
        modifiedComponent: 'flights',
        preserveFields: preserveHotel ? getAllHotelFields() : [],
        confidence: 0.85,
        matchedPattern: flightModPattern || 'airline_mention',
        flightModification: {
          airline: airlineCode // Usa código IATA en vez del nombre
        }
      } as IterationContext & { flightModification?: { stops?: string; luggage?: string; airline?: string } };
    }
  }

  // CASO 10: "lo mismo pero" con modificación de vuelo
  if (/\b(lo\s+mismo\s+pero|la\s+misma\s+pero)\b/i.test(norm) && hasFlightMod) {
    const baseType = lastSearch.requestType;
    const preserveHotel = baseType === 'combined';

    console.log('✅ [ITERATION] CASE 10: "lo mismo pero" with flight change → flight_modification');
    return {
      isIteration: true,
      iterationType: 'flight_modification',
      baseRequestType: baseType,
      modifiedComponent: 'flights',
      preserveFields: preserveHotel ? getAllHotelFields() : [],
      confidence: 0.9,
      matchedPattern: 'lo_mismo_pero_vuelo',
      flightModification: {
        stops: flightModDetails.stopsValue,
        luggage: flightModDetails.luggageValue
      }
    } as IterationContext & { flightModification?: { stops?: string; luggage?: string; airline?: string } };
  }

  // CASO 11: "agrega X adultos" después de error "solo menores"
  // Este caso permite al usuario corregir búsquedas donde solo especificó menores
  if (hasFlightMod && flightModDetails.adultsToAdd && flightModDetails.adultsToAdd > 0) {
    const baseType = lastSearch.requestType;
    const preserveHotel = baseType === 'combined';

    console.log(`✅ [ITERATION] CASE 11: Add ${flightModDetails.adultsToAdd} adults → flight_modification (passenger_update)`);
    return {
      isIteration: true,
      iterationType: 'flight_modification',
      baseRequestType: baseType,
      modifiedComponent: 'flights',
      preserveFields: preserveHotel ? getAllHotelFields() : [],
      confidence: 0.95,
      matchedPattern: 'add_adults',
      flightModification: {
        adults: flightModDetails.adultsToAdd
      }
    } as IterationContext;
  }

  // CASO 12: Modificación de cabin class (business, primera, economy, premium)
  if (hasFlightMod && flightModDetails.cabinClassValue && !hasNewFlightParams) {
    const baseType = lastSearch.requestType;
    const preserveHotel = baseType === 'combined';

    console.log(`✅ [ITERATION] CASE 12: Cabin class modification → flight_modification (${flightModDetails.cabinClassValue})`);
    return {
      isIteration: true,
      iterationType: 'flight_modification',
      baseRequestType: baseType,
      modifiedComponent: 'flights',
      preserveFields: preserveHotel ? getAllHotelFields() : [],
      confidence: 0.9,
      matchedPattern: flightModPattern,
      flightModification: {
        cabinClass: flightModDetails.cabinClassValue
      }
    } as IterationContext;
  }

  // DEFAULT: Nueva búsqueda
  console.log('ℹ️ [ITERATION] No iteration pattern matched → new_search');
  return {
    isIteration: false,
    iterationType: 'new_search',
    baseRequestType: null,
    modifiedComponent: null,
    preserveFields: [],
    confidence: 1.0
  };
}

/**
 * Retorna todos los campos de vuelo que deben preservarse
 */
function getAllFlightFields(): string[] {
  return [
    'flights.origin',
    'flights.destination',
    'flights.departureDate',
    'flights.returnDate',
    'flights.adults',
    'flights.children',
    'flights.infants',
    'flights.stops',
    'flights.preferredAirline',
    'flights.luggage',
    'flights.maxLayoverHours',
    'flights.cabinClass'
  ];
}

/**
 * Retorna todos los campos de hotel que deben preservarse
 */
function getAllHotelFields(): string[] {
  return [
    'hotels.city',
    'hotels.checkinDate',
    'hotels.checkoutDate',
    'hotels.adults',
    'hotels.children',
    'hotels.infants',
    'hotels.roomType',
    'hotels.mealPlan',
    'hotels.hotelChains',  // ✅ UPDATED: Changed from singular to plural
    'hotels.hotelName'
  ];
}

/**
 * Combina el contexto anterior con la nueva solicitud según el tipo de iteración
 * 
 * @param previousContext - Estado de contexto previo
 * @param newParsedRequest - Request parseado del mensaje actual
 * @param iterationContext - Resultado de detectIterationIntent()
 * @returns Request combinado con contexto preservado
 */
export function mergeIterationContext(
  previousContext: ContextState,
  newParsedRequest: ParsedTravelRequest,
  iterationContext: IterationContext
): ParsedTravelRequest {
  // Si no es iteración, devolver request sin cambios
  if (!iterationContext.isIteration) {
    return newParsedRequest;
  }

  const { lastSearch } = previousContext;

  console.log('🔄 [MERGE] Starting iteration merge');
  console.log('🔄 [MERGE] Iteration type:', iterationContext.iterationType);
  console.log('🔄 [MERGE] Base request type:', iterationContext.baseRequestType);
  console.log('🔄 [MERGE] Modified component:', iterationContext.modifiedComponent);

  // Para iteración de hotel sobre combined, preservar vuelo y actualizar hotel
  if (iterationContext.iterationType === 'hotel_modification') {
    const mergedRequest: ParsedTravelRequest = {
      ...newParsedRequest,
      requestType: 'combined', // Forzar combined para mantener vuelo + hotel

      // Preservar parámetros de vuelo del contexto anterior
      // IMPORTANTE: En hotel_modification, NO permitimos que el AI override los datos de vuelo
      // porque el usuario dijo "misma búsqueda pero hotel X" - el vuelo debe preservarse
      flights: {
        origin: lastSearch.flightsParams?.origin || '',
        destination: lastSearch.flightsParams?.destination || '',
        departureDate: lastSearch.flightsParams?.departureDate || '',
        returnDate: lastSearch.flightsParams?.returnDate,
        adults: lastSearch.flightsParams?.adults || 1,
        children: lastSearch.flightsParams?.children || 0,
        infants: lastSearch.flightsParams?.infants || 0,
        stops: lastSearch.flightsParams?.stops,
        preferredAirline: lastSearch.flightsParams?.preferredAirline,
        luggage: lastSearch.flightsParams?.luggage,
        maxLayoverHours: lastSearch.flightsParams?.maxLayoverHours,
        cabinClass: lastSearch.flightsParams?.cabinClass,
        // NO hacemos override de origin/destination en hotel_modification
        // El AI puede inventar datos que no corresponden al contexto real
      },

      // Combinar parámetros de hotel: base del contexto + nuevos filtros
      hotels: {
        // Base del contexto anterior (ciudad, fechas, pax)
        city: lastSearch.hotelsParams?.city || lastSearch.flightsParams?.destination || '',
        checkinDate: lastSearch.hotelsParams?.checkinDate || lastSearch.flightsParams?.departureDate || '',
        checkoutDate: lastSearch.hotelsParams?.checkoutDate || lastSearch.flightsParams?.returnDate || '',
        adults: lastSearch.hotelsParams?.adults || lastSearch.flightsParams?.adults || 1,
        children: lastSearch.hotelsParams?.children ?? lastSearch.flightsParams?.children ?? 0,
        infants: lastSearch.hotelsParams?.infants ?? lastSearch.flightsParams?.infants ?? 0,

        // Preservar preferencias anteriores a menos que se cambien explícitamente
        roomType: newParsedRequest.hotels?.roomType || lastSearch.hotelsParams?.roomType,
        mealPlan: newParsedRequest.hotels?.mealPlan || lastSearch.hotelsParams?.mealPlan,

        // Actualizar con nuevos filtros del usuario (ESTO ES LO NUEVO)
        ...(newParsedRequest.hotels?.hotelChains && { hotelChains: newParsedRequest.hotels.hotelChains }),  // ✅ UPDATED: Changed to plural
        ...(newParsedRequest.hotels?.hotelName && { hotelName: newParsedRequest.hotels.hotelName }),
        ...(newParsedRequest.hotels?.freeCancellation !== undefined && { freeCancellation: newParsedRequest.hotels.freeCancellation }),
      },

      // Preservar transfers y asistencia si existían
      transfers: newParsedRequest.transfers || undefined,
      travelAssistance: newParsedRequest.travelAssistance || undefined,

      confidence: Math.max(newParsedRequest.confidence || 0, iterationContext.confidence),
      originalMessage: newParsedRequest.originalMessage,
    };

    console.log('✅ [MERGE] Hotel modification merge complete:', {
      requestType: mergedRequest.requestType,
      flightsOrigin: mergedRequest.flights?.origin,
      flightsDest: mergedRequest.flights?.destination,
      hotelsCity: mergedRequest.hotels?.city,
      hotelChains: mergedRequest.hotels?.hotelChains,  // ✅ UPDATED: Changed to plural
      hotelName: mergedRequest.hotels?.hotelName
    });

    return mergedRequest;
  }

  // Para iteración de vuelo (escalas, equipaje, aerolínea, agregar adultos)
  if (iterationContext.iterationType === 'flight_modification') {
    const flightMod = iterationContext.flightModification;
    const preserveHotel = lastSearch.requestType === 'combined';

    // Determinar el número de adultos:
    // 1. Si hay flightMod.adults (de "agrega X adultos"), usarlo
    // 2. Si no, usar el contexto anterior (puede ser 0 si era "solo menores")
    // 3. Fallback a 1
    const adultsCount = flightMod?.adults ?? lastSearch.flightsParams?.adults ?? 1;

    const mergedRequest: ParsedTravelRequest = {
      ...newParsedRequest,
      requestType: preserveHotel ? 'combined' : 'flights',

      // Preservar parámetros de vuelo del contexto anterior + aplicar modificación
      flights: {
        origin: lastSearch.flightsParams?.origin || '',
        destination: lastSearch.flightsParams?.destination || '',
        departureDate: lastSearch.flightsParams?.departureDate || '',
        returnDate: lastSearch.flightsParams?.returnDate,
        adults: adultsCount,  // ✨ Usar adultos calculados (puede venir de "agrega X adultos")
        children: lastSearch.flightsParams?.children || 0,
        infants: lastSearch.flightsParams?.infants || 0,
        // Preservar valores anteriores por defecto
        stops: lastSearch.flightsParams?.stops,
        preferredAirline: lastSearch.flightsParams?.preferredAirline,
        luggage: lastSearch.flightsParams?.luggage,
        maxLayoverHours: lastSearch.flightsParams?.maxLayoverHours,
        departureTimePreference: lastSearch.flightsParams?.departureTimePreference,
        arrivalTimePreference: lastSearch.flightsParams?.arrivalTimePreference,
        cabinClass: lastSearch.flightsParams?.cabinClass,
        // Aplicar la modificación específica
        ...(flightMod?.stops && { stops: flightMod.stops as any }),
        ...(flightMod?.luggage && { luggage: flightMod.luggage as any }),
        ...(flightMod?.airline && { preferredAirline: flightMod.airline }),
        ...(flightMod?.departureTimePreference && { departureTimePreference: flightMod.departureTimePreference }),
        ...(flightMod?.arrivalTimePreference && { arrivalTimePreference: flightMod.arrivalTimePreference }),
        ...(flightMod?.maxLayoverHours !== undefined && { maxLayoverHours: flightMod.maxLayoverHours }),
        ...(flightMod?.cabinClass && { cabinClass: flightMod.cabinClass }),
        // También permitir overrides del AI parser
        ...(newParsedRequest.flights?.stops && { stops: newParsedRequest.flights.stops }),
        ...(newParsedRequest.flights?.preferredAirline && { preferredAirline: newParsedRequest.flights.preferredAirline }),
        ...(newParsedRequest.flights?.luggage && { luggage: newParsedRequest.flights.luggage }),
        ...(newParsedRequest.flights?.departureTimePreference && { departureTimePreference: newParsedRequest.flights.departureTimePreference }),
        ...(newParsedRequest.flights?.arrivalTimePreference && { arrivalTimePreference: newParsedRequest.flights.arrivalTimePreference }),
        ...(newParsedRequest.flights?.maxLayoverHours !== undefined && { maxLayoverHours: newParsedRequest.flights.maxLayoverHours }),
        ...(newParsedRequest.flights?.cabinClass && { cabinClass: newParsedRequest.flights.cabinClass }),
      },

      // Preservar hotel si era búsqueda combined (actualizando adultos también)
      ...(preserveHotel && lastSearch.hotelsParams && {
        hotels: {
          city: lastSearch.hotelsParams.city,
          checkinDate: lastSearch.hotelsParams.checkinDate,
          checkoutDate: lastSearch.hotelsParams.checkoutDate,
          adults: flightMod?.adults ?? lastSearch.hotelsParams.adults,  // ✨ Actualizar adultos en hotel también
          children: lastSearch.hotelsParams.children || 0,
          infants: lastSearch.hotelsParams.infants || 0,
          roomType: lastSearch.hotelsParams.roomType,
          mealPlan: lastSearch.hotelsParams.mealPlan,
          hotelChains: lastSearch.hotelsParams.hotelChains,  // ✅ UPDATED: Changed to plural
          hotelName: lastSearch.hotelsParams.hotelName,
        }
      }),

      transfers: newParsedRequest.transfers || undefined,
      travelAssistance: newParsedRequest.travelAssistance || undefined,

      confidence: Math.max(newParsedRequest.confidence || 0, iterationContext.confidence),
      originalMessage: newParsedRequest.originalMessage,
    };

    console.log('✅ [MERGE] Flight modification merge complete:', {
      requestType: mergedRequest.requestType,
      flightsOrigin: mergedRequest.flights?.origin,
      flightsDest: mergedRequest.flights?.destination,
      stops: mergedRequest.flights?.stops,
      luggage: mergedRequest.flights?.luggage,
      airline: mergedRequest.flights?.preferredAirline,
      adults: mergedRequest.flights?.adults,  // ✨ Log adults count
      children: mergedRequest.flights?.children,
      infants: mergedRequest.flights?.infants,
      preservedHotel: preserveHotel
    });

    return mergedRequest;
  }

  // Para reutilización completa
  if (iterationContext.iterationType === 'full_reuse') {
    const mergedRequest: ParsedTravelRequest = {
      ...newParsedRequest,
      requestType: lastSearch.requestType,
      flights: lastSearch.flightsParams ? {
        ...lastSearch.flightsParams,
        ...(newParsedRequest.flights || {})
      } : newParsedRequest.flights,
      hotels: lastSearch.hotelsParams ? {
        ...lastSearch.hotelsParams,
        ...(newParsedRequest.hotels || {})
      } : newParsedRequest.hotels,
      confidence: iterationContext.confidence,
      originalMessage: newParsedRequest.originalMessage,
    };

    console.log('✅ [MERGE] Full reuse merge complete');
    return mergedRequest;
  }

  // Default: sin merge especial
  return newParsedRequest;
}

/**
 * Genera un mensaje explicativo para el usuario sobre qué se mantuvo y qué cambió
 */
export function generateIterationExplanation(
  iterationContext: IterationContext,
  previousContext: ContextState
): string {
  if (!iterationContext.isIteration) {
    return '';
  }

  const { lastSearch } = previousContext;

  if (iterationContext.iterationType === 'hotel_modification') {
    const origin = lastSearch.flightsParams?.origin || '?';
    const dest = lastSearch.flightsParams?.destination || '?';
    const dates = lastSearch.flightsParams?.departureDate
      ? `${lastSearch.flightsParams.departureDate}${lastSearch.flightsParams.returnDate ? ` al ${lastSearch.flightsParams.returnDate}` : ''}`
      : '';
    const pax = lastSearch.flightsParams?.adults || 1;

    return `🔄 **Búsqueda actualizada** (mantuve tu vuelo anterior)\n\n✈️ **Vuelo:** ${origin} → ${dest}${dates ? ` | ${dates}` : ''} | ${pax} adulto(s)\n\n`;
  }

  if (iterationContext.iterationType === 'flight_modification') {
    const flightMod = iterationContext.flightModification;
    let changeDesc = '';

    if (flightMod?.stops) {
      const stopsMap: Record<string, string> = {
        'direct': 'vuelos directos',
        'with_stops': 'vuelos con escalas',
        'one_stop': 'vuelos con 1 escala',
        'two_stops': 'vuelos con 2 escalas'
      };
      changeDesc = stopsMap[flightMod.stops] || flightMod.stops;
    } else if (flightMod?.luggage) {
      const luggageMap: Record<string, string> = {
        'checked': 'con equipaje facturado',
        'carry_on': 'solo equipaje de mano'
      };
      changeDesc = luggageMap[flightMod.luggage] || flightMod.luggage;
    } else if (flightMod?.airline) {
      changeDesc = `con ${flightMod.airline}`;
    } else if (flightMod?.departureTimePreference) {
      const timeMap: Record<string, string> = {
        'morning': 'que salga de mañana',
        'afternoon': 'que salga de tarde',
        'evening': 'que salga de noche',
        'night': 'que salga de madrugada'
      };
      changeDesc = timeMap[flightMod.departureTimePreference] || `salida ${flightMod.departureTimePreference}`;
    } else if (flightMod?.arrivalTimePreference) {
      const timeMap: Record<string, string> = {
        'morning': 'que llegue de mañana',
        'afternoon': 'que llegue de tarde',
        'evening': 'que llegue de noche',
        'night': 'que llegue de madrugada'
      };
      changeDesc = timeMap[flightMod.arrivalTimePreference] || `llegada ${flightMod.arrivalTimePreference}`;
    } else if (flightMod?.maxLayoverHours !== undefined) {
      changeDesc = `escalas de máximo ${flightMod.maxLayoverHours}h`;
    }

    const origin = lastSearch.flightsParams?.origin || '?';
    const dest = lastSearch.flightsParams?.destination || '?';

    return `🔄 **Búsqueda actualizada** (${changeDesc})\n\n✈️ **Ruta:** ${origin} → ${dest}\n\n`;
  }

  return '🔄 **Búsqueda actualizada con tus preferencias anteriores**\n\n';
}

