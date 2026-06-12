/**
 * Advanced Filters for API Search
 *
 * Ported from src/features/chat/services/searchHandlers.ts and src/utils/roomFilters.ts
 * to replicate 100% the internal chat behavior in the API.
 *
 * Includes:
 * - Punta Cana hotel whitelist
 * - Room-level filtering (capacity + meal plan)
 * - Light fare detection
 * - Inferred adults logic
 * - Hotel chain detection and matching
 */

import {
  HOTEL_CHAINS,
  detectHotelChainInText,
  hotelBelongsToChain as chainMatchesHotel,
  hotelBelongsToAnyChain,
  detectMultipleHotelChains
} from '../data/hotelChainAliases.js';

// =============================================================================
// HOTEL TYPES (simplified for Edge Functions)
// =============================================================================

interface HotelRoom {
  description?: string;
  fare_id_broker?: string;
  total_price: number;
  currency: string;
  [key: string]: any;
}

interface Hotel {
  name: string;
  rooms: HotelRoom[];
  [key: string]: any;
}

// =============================================================================
// PUNTA CANA WHITELIST
// =============================================================================

/**
 * Palabras clave para detectar hoteles permitidos en Punta Cana.
 * Cada array interno representa un hotel; el hotel debe contener TODAS las palabras del array.
 */
const PUNTA_CANA_ALLOWED_HOTELS = [
  ['riu', 'bambu'],
  ['iberostar', 'dominicana'],
  ['bahia', 'principe', 'grand', 'punta', 'cana'],
  ['sunscape', 'coco'],
  ['riu', 'republica'],
  ['dreams', 'punta', 'cana'],
  ['now', 'onyx'],
  ['secrets', 'cap', 'cana'],
  ['excellence', 'punta', 'cana'],
  ['majestic', 'elegance'],
  ['barcelo', 'bavaro'],
  ['occidental', 'punta', 'cana'],
  ['paradisus', 'punta', 'cana'],
  ['hard', 'rock', 'punta', 'cana'],
  ['royalton', 'punta', 'cana'],
  ['hideaway', 'royalton'],
  ['chic', 'punta', 'cana'],
  ['lopesan', 'costa', 'bavaro'],
  ['luxury', 'bahia', 'principe'],
  ['grand', 'palladium'],
  ['trs', 'cap', 'cana'],
  ['catalonia', 'royal', 'bavaro'],
  ['hotel', 'riu', 'palace']
];

/**
 * Normaliza texto eliminando acentos y convirtiendo a minúsculas.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Verifica si el destino corresponde a Punta Cana.
 */
function isPuntaCanaDestination(city: string): boolean {
  const normalized = normalizeText(city);
  return normalized.includes('punta') && normalized.includes('cana');
}

/**
 * Verifica si el nombre del hotel está en la whitelist de Punta Cana.
 */
function isAllowedPuntaCanaHotel(hotelName: string): boolean {
  const normalizedName = normalizeText(hotelName);

  return PUNTA_CANA_ALLOWED_HOTELS.some(keywords =>
    keywords.every(keyword => normalizedName.includes(keyword))
  );
}

/**
 * Aplica whitelist de Punta Cana si el destino es Punta Cana.
 *
 * IMPORTANTE: Si el usuario especificó cadenas, permite TODOS los hoteles de esas cadenas.
 */
export function applyDestinationWhitelist(
  hotels: Hotel[],
  city: string,
  requestedChains?: string | string[]
): Hotel[] {
  // Solo aplicar filtro para Punta Cana
  if (!isPuntaCanaDestination(city)) {
    return hotels;
  }

  console.log('🌴 [PUNTA CANA FILTER] Applying special hotel whitelist');
  console.log(`📊 [PUNTA CANA FILTER] Hotels before filter: ${hotels.length}`);

  const chainList = Array.isArray(requestedChains)
    ? requestedChains
    : requestedChains
      ? [requestedChains]
      : [];
  const normalizedChains = Array.from(
    new Map(
      chainList
        .map(chain => chain.trim())
        .filter(Boolean)
        .map(chain => [normalizeText(chain), chain])
    ).values()
  );

  if (normalizedChains.length > 0) {
    console.log(`🏨 [PUNTA CANA FILTER] User requested chains: ${normalizedChains.join(', ')} - allowing all hotels from these chains`);
  }

  const filteredHotels = hotels.filter(hotel => {
    // FIRST: If user requested specific chains, allow ALL hotels from any of those chains
    if (normalizedChains.length > 0 && hotelBelongsToAnyChain(hotel.name, normalizedChains)) {
      console.log(`✅ [PUNTA CANA FILTER] Allowed (matches requested chains): "${hotel.name}"`);
      return true;
    }

    // SECOND: Check against the whitelist for non-chain-specific requests
    const isAllowed = isAllowedPuntaCanaHotel(hotel.name);
    if (!isAllowed) {
      console.log(`🚫 [PUNTA CANA FILTER] Excluded: "${hotel.name}"`);
    } else {
      console.log(`✅ [PUNTA CANA FILTER] Allowed (in whitelist): "${hotel.name}"`);
    }
    return isAllowed;
  });

  console.log(`📊 [PUNTA CANA FILTER] Hotels after filter: ${filteredHotels.length}`);
  return filteredHotels;
}

// =============================================================================
// ROOM FILTERING (Capacity + Meal Plan)
// =============================================================================

type CapacityType = 'single' | 'double' | 'triple' | 'quad';
type MealPlanType = 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only';

const CAPACITY_CODES = {
  single: ['SGL'],
  double: ['DBL', 'TWN', 'DBT', 'C2'],
  triple: ['TPL', 'C3'],
  quad: ['QUA', 'C4']
} as const;

const CAPACITY_KEYWORDS = {
  single: [
    'SINGLE', 'SINGLE ROOM', 'SENCILLA', 'INDIVIDUAL',
    '1 ADULT', '1 ADULTO', 'SGL ROOM', 'HABITACION SENCILLA', 'HABITACIÓN SENCILLA'
  ],
  double: [
    'DOUBLE', 'DOUBLE ROOM', 'TWIN', 'TWIN ROOM', 'DOBLE', 'HABITACION DOBLE', 'HABITACIÓN DOBLE',
    'KING', 'KING ROOM', 'QUEEN', 'QUEEN ROOM', '2 ADULTS', '2 ADULTOS',
    'DBL ROOM', 'TWN ROOM', 'STANDARD DOUBLE', 'STANDARD TWIN',
    'MATRIMONIAL', 'CAMA DOBLE', 'DOS CAMAS', 'TWO BEDS'
  ],
  triple: [
    'TRIPLE', 'TRIPLE ROOM', 'HABITACION TRIPLE', 'HABITACIÓN TRIPLE',
    '3 ADULTS', '3 ADULTOS', '3 PAXS', '3 PAX', 'TPL ROOM',
    'THREE BEDS', 'TRES CAMAS', 'TRIPLE STANDARD'
  ],
  quad: [
    'QUADRUPLE', 'QUAD', 'QUAD ROOM', 'CUADRUPLE', 'CUÁDRUPLE',
    'HABITACION CUADRUPLE', 'HABITACIÓN CUÁDRUPLE',
    '4 ADULTS', '4 ADULTOS', '4 PAXS', '4 PAX', 'FOUR BEDS', 'CUATRO CAMAS'
  ]
} as const;

const CAPACITY_EXCLUSIONS = {
  single: [],
  double: ['TRIPLE', 'QUADRUPLE', 'CUADRUPLE'],
  triple: ['QUADRUPLE', 'CUADRUPLE'],
  quad: []
} as const;

const MEAL_PLAN_KEYWORDS = {
  all_inclusive: ['ALL INCLUSIVE', 'TODO INCLUIDO', 'ALL-INCLUSIVE'],
  breakfast: ['BED AND BREAKFAST', 'BUFFET BREAKFAST', 'BREAKFAST', 'DESAYUNO', 'B&B'],
  half_board: ['HALF BOARD', 'MEDIA PENSIÓN', 'MEDIA PENSION', 'HALF-BOARD'],
  room_only: ['ROOM ONLY', 'SOLO ALOJAMIENTO', 'SIN COMIDA', 'ALOJAMIENTO']
} as const;

/**
 * Normalize user input to standard capacity enum
 */
export function normalizeCapacity(input?: string): CapacityType | undefined {
  if (!input) return undefined;
  const normalized = input.toLowerCase().trim();

  if (normalized === 'single' || normalized === 'sencilla' || normalized === 'individual') return 'single';
  if (normalized === 'double' || normalized === 'doble' || normalized === 'standard') return 'double';
  if (normalized === 'triple') return 'triple';
  if (normalized === 'quad' || normalized === 'cuadruple' || normalized === 'cuádruple') return 'quad';

  return undefined;
}

/**
 * Normalize user input to standard meal plan enum
 */
export function normalizeMealPlan(input?: string): MealPlanType | undefined {
  if (!input) return undefined;
  const normalized = input.toLowerCase().trim();

  if (normalized === 'all inclusive' || normalized === 'todo incluido' || normalized === 'all_inclusive' || normalized === 'all-inclusive') {
    return 'all_inclusive';
  }
  if (normalized === 'breakfast' || normalized === 'desayuno') {
    return 'breakfast';
  }
  if (normalized === 'half board' || normalized === 'media pensión' || normalized === 'media pension' || normalized === 'half_board' || normalized === 'half-board') {
    return 'half_board';
  }
  if (normalized === 'room only' || normalized === 'solo habitación' || normalized === 'solo habitacion' || normalized === 'room_only') {
    return 'room_only';
  }

  return undefined;
}

function extractCapacityCode(fareIdBroker?: string): string | null {
  if (!fareIdBroker) return null;
  const segments = fareIdBroker.split('|');
  if (segments.length < 4) return null;
  return segments[3].trim();
}

function matchesCapacityCode(code: string, targetCapacity: CapacityType): boolean {
  const targetCodes = CAPACITY_CODES[targetCapacity];
  return targetCodes.some(targetCode => code.toUpperCase().startsWith(targetCode));
}

function matchesCapacityDescription(description: string, targetCapacity: CapacityType): boolean {
  const descUpper = description.toUpperCase();
  const keywords = CAPACITY_KEYWORDS[targetCapacity];
  return keywords.some(keyword => descUpper.includes(keyword));
}

function hasCapacityExclusion(description: string, targetCapacity: CapacityType): boolean {
  const descUpper = description.toUpperCase();
  const exclusions = CAPACITY_EXCLUSIONS[targetCapacity];
  return exclusions.some(exclusion => descUpper.includes(exclusion));
}

function filterRoomsByCapacity(rooms: HotelRoom[], targetCapacity: CapacityType): HotelRoom[] {
  return rooms.filter(room => {
    const capacityCode = extractCapacityCode(room.fare_id_broker);
    const description = room.description || '';

    // Exclusion check
    if (hasCapacityExclusion(description, targetCapacity)) {
      return false;
    }

    // Check code match
    if (capacityCode && matchesCapacityCode(capacityCode, targetCapacity)) {
      return true;
    }

    // Check description match
    if (matchesCapacityDescription(description, targetCapacity)) {
      return true;
    }

    return false;
  });
}

function filterRoomsByMealPlan(rooms: HotelRoom[], targetMealPlan: MealPlanType): HotelRoom[] {
  const keywords = MEAL_PLAN_KEYWORDS[targetMealPlan];

  return rooms.filter(room => {
    const descUpper = (room.description || '').toUpperCase();
    return keywords.some(keyword => descUpper.includes(keyword));
  });
}

export interface RoomFilterOptions {
  capacity?: CapacityType;
  mealPlan?: MealPlanType;
}

/**
 * Filter rooms by capacity and/or meal plan
 */
export function filterRooms(rooms: HotelRoom[], options: RoomFilterOptions): HotelRoom[] {
  let filtered = [...rooms];

  if (options.capacity) {
    filtered = filterRoomsByCapacity(filtered, options.capacity);
  }

  if (options.mealPlan) {
    filtered = filterRoomsByMealPlan(filtered, options.mealPlan);
  }

  return filtered;
}

/**
 * Apply room-level filtering to hotels.
 * Hotels with NO matching rooms are EXCLUDED completely.
 */
export function applyRoomFiltering(
  hotels: Hotel[],
  roomType?: string,
  mealPlan?: string
): { hotels: Hotel[]; excludedCount: number } {
  const normalizedRoomType = normalizeCapacity(roomType);
  const normalizedMealPlan = normalizeMealPlan(mealPlan);

  if (!normalizedRoomType && !normalizedMealPlan) {
    return { hotels, excludedCount: 0 };
  }

  console.log('🔄 [ROOM FILTERING] Filtering hotels by room criteria');
  console.log(`   Room type: ${normalizedRoomType || 'any'}`);
  console.log(`   Meal plan: ${normalizedMealPlan || 'any'}`);

  let excludedCount = 0;

  const filteredHotels = hotels
    .map(hotel => {
      const filteredRooms = filterRooms(hotel.rooms, {
        capacity: normalizedRoomType,
        mealPlan: normalizedMealPlan
      });

      if (filteredRooms.length === 0) {
        console.log(`🚫 [ROOM FILTERING] Hotel "${hotel.name}" excluded (no matching rooms)`);
        excludedCount++;
        return null;
      }

      console.log(`✅ [ROOM FILTERING] Hotel "${hotel.name}": ${hotel.rooms.length} → ${filteredRooms.length} rooms`);

      return {
        ...hotel,
        rooms: filteredRooms
      };
    })
    .filter((hotel): hotel is Hotel => hotel !== null);

  console.log(`📊 [ROOM FILTERING] Hotels: ${hotels.length} → ${filteredHotels.length} (excluded: ${excludedCount})`);

  return { hotels: filteredHotels, excludedCount };
}

// =============================================================================
// LIGHT FARE DETECTION (for flights)
// =============================================================================

/**
 * Airlines with light fares (typically no checked baggage)
 */
const LIGHT_FARE_AIRLINES = ['LA', 'H2', 'AV', 'AM', 'JA', 'AR'];

/**
 * Check if flight result is from a light fare airline
 */
export function isLightFareAirline(airlineCode: string): boolean {
  return LIGHT_FARE_AIRLINES.includes(airlineCode.toUpperCase());
}

/**
 * Filter out light fare flights if user requested carry-on luggage
 * (light fares typically only include personal item/backpack, not real carry-on)
 *
 * Logic:
 * - backpack: DO NOT exclude light fares (they offer backpack)
 * - carry_on: EXCLUDE light fares (they only offer backpack, not real carry-on)
 * - checked: DO NOT exclude (handled by checked filter)
 */
export function shouldExcludeLightFare(
  airlineCode: string,
  requestedLuggage?: string
): boolean {
  // Only exclude light fares if user specifically requested carry_on (real cabin baggage)
  // For backpack, we WANT light fare airlines
  if (requestedLuggage !== 'carry_on') {
    return false;
  }

  return isLightFareAirline(airlineCode);
}

export function getLightFareAirlines(): string[] {
  return [...LIGHT_FARE_AIRLINES];
}

// =============================================================================
// INFERRED ADULTS (from room type)
// =============================================================================

/**
 * Infer number of adults from room type if not explicitly specified.
 *
 * When user says "habitación doble", they typically mean 2 adults.
 */
export function inferAdultsFromRoomType(
  specifiedAdults: number | undefined,
  roomType?: string
): number {
  // If adults already specified and > 1, use it
  if (specifiedAdults && specifiedAdults > 1) {
    return specifiedAdults;
  }

  // If no room type, return default (1)
  if (!roomType) {
    return specifiedAdults || 1;
  }

  const normalized = roomType.toLowerCase().trim();

  if (normalized === 'double' || normalized === 'twin' || normalized === 'doble') {
    console.log('🔄 [ADULTS INFERENCE] roomType="double" → adults=2');
    return 2;
  }

  if (normalized === 'triple') {
    console.log('🔄 [ADULTS INFERENCE] roomType="triple" → adults=3');
    return 3;
  }

  if (normalized === 'quad' || normalized === 'quadruple' || normalized === 'cuadruple') {
    console.log('🔄 [ADULTS INFERENCE] roomType="quad" → adults=4');
    return 4;
  }

  return specifiedAdults || 1;
}

// =============================================================================
// HOTEL CHAIN DETECTION (using centralized aliases)
// =============================================================================

/**
 * Detect hotel chain from text using centralized aliases
 * Re-exports from hotelChainAliases for convenience
 */
export function detectHotelChain(text: string): { key: string; name: string; matchedAlias: string } | null {
  return detectHotelChainInText(text);
}

/**
 * Check if a hotel belongs to a specific chain
 * Uses flexible matching with normalization
 *
 * @param hotelName - Full hotel name from API (e.g., "RIU BAMBU")
 * @param chainName - Chain to check (e.g., "RIU", "riu", "Riu")
 * @returns true if hotel belongs to the chain
 */
export function hotelBelongsToChain(hotelName: string, chainName: string): boolean {
  return chainMatchesHotel(hotelName, chainName);
}

/**
 * Check if a hotel belongs to any of the specified chains
 *
 * @param hotelName - Hotel name to check
 * @param chains - Array of chain names to check against
 * @returns true if hotel belongs to any chain in the array
 */
export function hotelMatchesAnyChain(hotelName: string, chains: string[]): boolean {
  return hotelBelongsToAnyChain(hotelName, chains);
}

/**
 * Detect multiple hotel chains mentioned in text
 *
 * @param text - User input text
 * @returns Array of detected chain names
 */
export function detectMultipleChains(text: string): string[] {
  return detectMultipleHotelChains(text);
}

/**
 * Get all known hotel chain keys
 */
export function getKnownHotelChains(): string[] {
  return Object.keys(HOTEL_CHAINS);
}
