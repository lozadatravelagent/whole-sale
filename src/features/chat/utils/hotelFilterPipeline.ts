import type { HotelData } from '@/types';
import type { MealPlanType } from '@/utils/roomFilters';
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
 * Filtra hoteles y retorna Top N ordenados por precio
 */
export function filterAndLimitHotels(
  hotels: HotelData[],
  mealPlan: MealPlanType | null,
  limit: number = 5
): HotelData[] {
  const filtered = filterHotelsByMealPlan(hotels, mealPlan);

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
