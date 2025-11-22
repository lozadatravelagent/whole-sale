import { HotelRoom } from '@/types';

/**
 * Room Filtering Logic - Expert System
 *
 * Filters hotel rooms based on natural language queries (e.g., "double room all inclusive")
 * Uses fare_id_broker and description fields with a two-filter strategy (Capacity + Meal Plan)
 */

// =====================================================================
// FILTER A: CAPACITY (Single, Double, Triple, Quad)
// =====================================================================

/**
 * Capacity codes found in fare_id_broker (4th segment after splitting by |)
 * Example: "AP|5178-1509199|1|DBL.ST|..." → "DBL.ST"
 */
const CAPACITY_CODES = {
  single: ['SGL'],
  double: ['DBL', 'TWN', 'DBT', 'C2'],
  triple: ['TPL', 'C3'],
  quad: ['QUA', 'C4']
} as const;

/**
 * Capacity keywords in description (fallback when code is generic like ROO, SUI, JSU)
 */
const CAPACITY_KEYWORDS = {
  single: ['SINGLE', '1 ADULT', 'INDIVIDUAL'],
  double: ['DOUBLE', 'KING', 'QUEEN', 'TWIN', '2 ADULTS', 'DOBLE'],
  triple: ['TRIPLE', '3 ADULTS', '3 PAXS'],
  quad: ['QUADRUPLE', '4 ADULTS', '4 PAXS', 'CUADRUPLE']
} as const;

/**
 * Exclusion keywords to prevent false positives
 * Example: For "double" searches, exclude rooms with "TRIPLE" or "QUADRUPLE" in description
 */
const CAPACITY_EXCLUSIONS = {
  single: [],
  double: ['TRIPLE', 'QUADRUPLE', 'CUADRUPLE'],
  triple: ['QUADRUPLE', 'CUADRUPLE'],
  quad: []
} as const;

// =====================================================================
// FILTER B: MEAL PLAN / REGIME
// =====================================================================

/**
 * Meal plan keywords in description (Spanish → English normalization)
 * Note: Meal plan info is ONLY in description, NOT in fare_id_broker
 */
const MEAL_PLAN_KEYWORDS = {
  all_inclusive: ['ALL INCLUSIVE', 'TODO INCLUIDO', 'ALL-INCLUSIVE'],
  breakfast: ['BED AND BREAKFAST', 'BUFFET BREAKFAST', 'BREAKFAST', 'DESAYUNO', 'B&B'],
  half_board: ['HALF BOARD', 'MEDIA PENSIÓN', 'MEDIA PENSION', 'HALF-BOARD'],
  room_only: ['ROOM ONLY', 'SOLO ALOJAMIENTO', 'SIN COMIDA', 'ALOJAMIENTO']
} as const;

// =====================================================================
// NORMALIZATION (Spanish → English enum values)
// =====================================================================

export type CapacityType = 'single' | 'double' | 'triple' | 'quad';
export type MealPlanType = 'all_inclusive' | 'breakfast' | 'half_board' | 'room_only';

/**
 * Normalize Spanish/English user input to standard capacity enum
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
 * Normalize Spanish/English user input to standard meal plan enum
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

// =====================================================================
// CORE FILTERING LOGIC
// =====================================================================

/**
 * Extract capacity code from fare_id_broker (4th segment)
 * Example: "AP|5178-1509199|1|DBL.ST|..." → "DBL.ST"
 */
function extractCapacityCode(fareIdBroker?: string): string | null {
  if (!fareIdBroker) return null;

  const segments = fareIdBroker.split('|');
  if (segments.length < 4) return null;

  return segments[3].trim();
}

/**
 * Check if capacity code matches the target capacity
 * Returns true if the code starts with any of the target codes (e.g., "DBL" matches "DBL.ST")
 */
function matchesCapacityCode(code: string, targetCapacity: CapacityType): boolean {
  const targetCodes = CAPACITY_CODES[targetCapacity];
  return targetCodes.some(targetCode => code.toUpperCase().startsWith(targetCode));
}

/**
 * Check if description contains capacity keywords
 */
function matchesCapacityDescription(description: string, targetCapacity: CapacityType): boolean {
  const descUpper = description.toUpperCase();
  const keywords = CAPACITY_KEYWORDS[targetCapacity];
  return keywords.some(keyword => descUpper.includes(keyword));
}

/**
 * Check if description contains exclusion keywords (for preventing false positives)
 */
function hasCapacityExclusion(description: string, targetCapacity: CapacityType): boolean {
  const descUpper = description.toUpperCase();
  const exclusions = CAPACITY_EXCLUSIONS[targetCapacity];
  return exclusions.some(exclusion => descUpper.includes(exclusion));
}

/**
 * Filter rooms by capacity (FILTER A)
 * Uses hierarchical logic: fare_id_broker code → description keywords → exclusions
 */
function filterByCapacity(rooms: HotelRoom[], targetCapacity: CapacityType): HotelRoom[] {
  console.log(`🔍 [CAPACITY FILTER] Filtering ${rooms.length} rooms for capacity: ${targetCapacity}`);

  const filtered = rooms.filter(room => {
    const capacityCode = extractCapacityCode(room.fare_id_broker);
    const description = room.description || '';

    // PRIMARY SOURCE: Check fare_id_broker code (most reliable)
    if (capacityCode) {
      const matchesByCode = matchesCapacityCode(capacityCode, targetCapacity);
      if (matchesByCode) {
        console.log(`✅ [CODE MATCH] ${room.description?.substring(0, 50)} | Code: ${capacityCode}`);
        return true;
      }

      // If code is generic (ROO, SUI, JSU, etc.) or numeric (like "1"), fall back to description
      const genericCodes = ['ROO', 'SUI', 'JSU', 'STD', '1'];
      const isGenericCode = genericCodes.some(generic => capacityCode.toUpperCase().startsWith(generic));

      if (!isGenericCode) {
        // Code is specific but doesn't match - reject
        console.log(`❌ [CODE MISMATCH] ${room.description?.substring(0, 50)} | Code: ${capacityCode}`);
        return false;
      }
    }

    // SECONDARY SOURCE: Check description keywords (fallback for generic codes or missing codes)
    const matchesByDescription = matchesCapacityDescription(description, targetCapacity);

    if (!matchesByDescription) {
      console.log(`❌ [DESC MISMATCH] ${room.description?.substring(0, 50)}`);
      return false;
    }

    // EXCLUSION CHECK: Prevent false positives (e.g., "double" search shouldn't match "TRIPLE")
    const hasExclusion = hasCapacityExclusion(description, targetCapacity);
    if (hasExclusion) {
      console.log(`❌ [EXCLUSION] ${room.description?.substring(0, 50)} | Contains exclusion keyword`);
      return false;
    }

    console.log(`✅ [DESC MATCH] ${room.description?.substring(0, 50)}`);
    return true;
  });

  console.log(`📊 [CAPACITY FILTER] Result: ${rooms.length} → ${filtered.length} rooms`);
  return filtered;
}

/**
 * Filter rooms by meal plan (FILTER B)
 * Uses description field only (meal plan not coded in fare_id_broker)
 */
function filterByMealPlan(rooms: HotelRoom[], targetMealPlan: MealPlanType): HotelRoom[] {
  console.log(`🔍 [MEAL PLAN FILTER] Filtering ${rooms.length} rooms for meal plan: ${targetMealPlan}`);

  const keywords = MEAL_PLAN_KEYWORDS[targetMealPlan];

  const filtered = rooms.filter(room => {
    const descUpper = (room.description || '').toUpperCase();
    const matches = keywords.some(keyword => descUpper.includes(keyword));

    if (matches) {
      console.log(`✅ [MEAL MATCH] ${room.description?.substring(0, 50)}`);
    } else {
      console.log(`❌ [MEAL MISMATCH] ${room.description?.substring(0, 50)}`);
    }

    return matches;
  });

  console.log(`📊 [MEAL PLAN FILTER] Result: ${rooms.length} → ${filtered.length} rooms`);
  return filtered;
}

// =====================================================================
// PUBLIC API
// =====================================================================

export interface RoomFilterOptions {
  capacity?: CapacityType;
  mealPlan?: MealPlanType;
}

/**
 * Main filtering function - Applies both filters with AND logic
 *
 * @param rooms - Array of hotel rooms to filter
 * @param options - Filter options (capacity and/or meal plan)
 * @returns Filtered array of rooms
 *
 * @example
 * // Filter for double rooms with all inclusive
 * filterRooms(rooms, { capacity: 'double', mealPlan: 'all_inclusive' })
 *
 * @example
 * // Filter for capacity only
 * filterRooms(rooms, { capacity: 'triple' })
 *
 * @example
 * // Filter for meal plan only
 * filterRooms(rooms, { mealPlan: 'breakfast' })
 */
export function filterRooms(rooms: HotelRoom[], options: RoomFilterOptions): HotelRoom[] {
  console.log(`🎯 [ROOM FILTER] Starting filter with options:`, options);
  console.log(`📊 [ROOM FILTER] Input: ${rooms.length} rooms`);

  let filtered = [...rooms];

  // FILTER A: Capacity (if specified)
  if (options.capacity) {
    filtered = filterByCapacity(filtered, options.capacity);

    if (filtered.length === 0) {
      console.warn(`⚠️ [ROOM FILTER] No rooms found matching capacity: ${options.capacity}`);
      return [];
    }
  }

  // FILTER B: Meal Plan (if specified)
  if (options.mealPlan) {
    filtered = filterByMealPlan(filtered, options.mealPlan);

    if (filtered.length === 0) {
      console.warn(`⚠️ [ROOM FILTER] No rooms found matching meal plan: ${options.mealPlan}`);
      return [];
    }
  }

  console.log(`✅ [ROOM FILTER] Final result: ${rooms.length} → ${filtered.length} rooms`);
  return filtered;
}

/**
 * Helper function to filter rooms from a natural language query
 *
 * @param rooms - Array of hotel rooms to filter
 * @param query - Natural language query (e.g., "habitación doble todo incluido")
 * @returns Filtered array of rooms
 *
 * @example
 * filterRoomsByQuery(rooms, "habitación doble todo incluido")
 * // Returns rooms matching: capacity='double' AND mealPlan='all_inclusive'
 */
export function filterRoomsByQuery(rooms: HotelRoom[], query: string): HotelRoom[] {
  const queryLower = query.toLowerCase();

  // Detect capacity intent
  let capacity: CapacityType | undefined;
  if (queryLower.includes('single') || queryLower.includes('sencilla') || queryLower.includes('individual')) {
    capacity = 'single';
  } else if (queryLower.includes('doble') || queryLower.includes('double')) {
    capacity = 'double';
  } else if (queryLower.includes('triple')) {
    capacity = 'triple';
  } else if (queryLower.includes('cuadruple') || queryLower.includes('quad')) {
    capacity = 'quad';
  }

  // Detect meal plan intent
  let mealPlan: MealPlanType | undefined;
  if (queryLower.includes('todo incluido') || queryLower.includes('all inclusive')) {
    mealPlan = 'all_inclusive';
  } else if (queryLower.includes('desayuno') || queryLower.includes('breakfast')) {
    mealPlan = 'breakfast';
  } else if (queryLower.includes('media pensión') || queryLower.includes('media pension') || queryLower.includes('half board')) {
    mealPlan = 'half_board';
  } else if (queryLower.includes('solo habitación') || queryLower.includes('room only')) {
    mealPlan = 'room_only';
  }

  console.log(`🗣️ [QUERY FILTER] Query: "${query}" → Capacity: ${capacity || 'none'}, Meal Plan: ${mealPlan || 'none'}`);

  return filterRooms(rooms, { capacity, mealPlan });
}
