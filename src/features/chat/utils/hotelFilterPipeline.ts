import type { HotelData } from '@/types';
import type { MealPlanType } from '@/utils/roomFilters';
import type { PriceRangeFilter } from '../types/hotelSearchCache';
import { filterRooms } from '@/utils/roomFilters';

/**
 * Distribución de planes de comida para UI
 */
export interface MealPlanDistribution {
  all_inclusive: number;
  breakfast: number;
  half_board: number;
  room_only: number;
}

/**
 * Obtiene el precio mínimo por noche de un hotel (de todas sus habitaciones)
 */
export function getMinPricePerNight(hotel: HotelData): number {
  if (!hotel.rooms?.length) return Infinity;

  const prices = hotel.rooms
    .map(r => r.price_per_night || r.total_price / (hotel.nights || 1))
    .filter(p => p > 0);

  return prices.length > 0 ? Math.min(...prices) : Infinity;
}

/**
 * Filtra hoteles por rango de precio por noche.
 * - `range === null` (o ambos extremos null) → no se aplica filtro.
 * - `min` solo → excluye hoteles más baratos que `min`.
 * - `max` solo → excluye hoteles más caros que `max`.
 * - Hoteles sin precio resoluble (Infinity) se excluyen cuando hay filtro activo.
 */
export function filterHotelsByPriceRange(
  hotels: HotelData[],
  range: PriceRangeFilter | null,
): HotelData[] {
  if (!range || (range.min == null && range.max == null)) return hotels;

  return hotels.filter(hotel => {
    const price = getMinPricePerNight(hotel);
    if (!Number.isFinite(price)) return false;
    if (range.min != null && price < range.min) return false;
    if (range.max != null && price > range.max) return false;
    return true;
  });
}

/**
 * Calcula los límites min/max de precio por noche en una búsqueda.
 * Útil para inicializar sliders y validar inputs del usuario.
 * Retorna `null` si ningún hotel tiene precio resoluble.
 */
export function calculatePriceRangeBounds(hotels: HotelData[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const hotel of hotels) {
    const price = getMinPricePerNight(hotel);
    if (!Number.isFinite(price)) continue;
    if (price < min) min = price;
    if (price > max) max = price;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

/**
 * Verifica si un hotel tiene al menos una habitación que coincide con el plan de comidas
 */
function hotelHasMealPlan(hotel: HotelData, mealPlan: MealPlanType): boolean {
  if (!hotel.rooms?.length) return false;

  const filteredRooms = filterRooms(hotel.rooms, { mealPlan });
  return filteredRooms.length > 0;
}

/**
 * Filtra hoteles por plan de comida
 */
export function filterHotelsByMealPlan(
  hotels: HotelData[],
  mealPlan: MealPlanType | null
): HotelData[] {
  if (!mealPlan) return hotels;

  return hotels.filter(hotel => hotelHasMealPlan(hotel, mealPlan));
}

/**
 * Filtra hoteles por plan de comida + rango de precio, ordena por precio y limita a Top N.
 * `priceRange` es opcional para mantener compatibilidad con call sites antiguos.
 */
export function filterAndLimitHotels(
  hotels: HotelData[],
  mealPlan: MealPlanType | null,
  limit: number = 5,
  priceRange: PriceRangeFilter | null = null,
): HotelData[] {
  const filteredByMealPlan = filterHotelsByMealPlan(hotels, mealPlan);
  const filtered = filterHotelsByPriceRange(filteredByMealPlan, priceRange);

  // Ordenar por precio mínimo por noche (ascendente)
  const sorted = [...filtered].sort((a, b) => {
    const priceA = getMinPricePerNight(a);
    const priceB = getMinPricePerNight(b);
    return priceA - priceB;
  });

  return sorted.slice(0, limit);
}

/**
 * Calcula la distribución de planes de comida para mostrar en chips
 * IMPORTANTE: Siempre calcula sobre TODOS los hoteles originales para mantener conteos estables
 */
export function calculateMealPlanDistribution(hotels: HotelData[]): MealPlanDistribution {
  const distribution: MealPlanDistribution = {
    all_inclusive: 0,
    breakfast: 0,
    half_board: 0,
    room_only: 0,
  };

  for (const hotel of hotels) {
    if (hotelHasMealPlan(hotel, 'all_inclusive')) distribution.all_inclusive++;
    if (hotelHasMealPlan(hotel, 'breakfast')) distribution.breakfast++;
    if (hotelHasMealPlan(hotel, 'half_board')) distribution.half_board++;
    if (hotelHasMealPlan(hotel, 'room_only')) distribution.room_only++;
  }

  return distribution;
}
