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
 * Mapa de precios exactos por noche por hotel (clave = hotel.id).
 * Se popula con el resultado de `makeBudget` post-búsqueda — refleja el
 * `agencyPricing.netoAgencia` real, que es lo que el usuario ve en la tarjeta.
 * Cuando hay un precio exacto, los chips/filtros lo prefieren sobre el
 * `room.price_per_night` crudo de la búsqueda inicial.
 */
export type ExactPricePerNightMap = Record<string, number | undefined>;

/**
 * Obtiene el precio mínimo por noche de un hotel.
 * Prefiere el precio exacto de `makeBudget` (lo que se muestra en la card)
 * y cae al `room.price_per_night` crudo de EUROVIPS como fallback.
 */
export function getMinPricePerNight(
  hotel: HotelData,
  exactPrices?: ExactPricePerNightMap,
): number {
  const exact = exactPrices?.[hotel.id];
  if (typeof exact === 'number' && Number.isFinite(exact) && exact > 0) {
    return exact;
  }

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
  exactPrices?: ExactPricePerNightMap,
): HotelData[] {
  if (!range || (range.min == null && range.max == null)) return hotels;

  return hotels.filter(hotel => {
    const price = getMinPricePerNight(hotel, exactPrices);
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
export function calculatePriceRangeBounds(
  hotels: HotelData[],
  exactPrices?: ExactPricePerNightMap,
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const hotel of hotels) {
    const price = getMinPricePerNight(hotel, exactPrices);
    if (!Number.isFinite(price)) continue;
    if (price < min) min = price;
    if (price > max) max = price;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

/**
 * Bucket de precio por noche generado dinámicamente desde los bounds reales
 * de la búsqueda. Los buckets son intervalos abiertos a la derecha excepto
 * el último: `[min, max)` para los intermedios y `[min, max]` para el final.
 */
export interface PriceBucket {
  id: string;
  min: number | null;
  max: number | null;
  label: string;
}

/** Redondea hacia el múltiplo más cercano de `step`. */
function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Devuelve un step "humano" según la magnitud del rango. */
function pickStep(range: number): number {
  if (range >= 5000) return 500;
  if (range >= 2000) return 250;
  if (range >= 1000) return 100;
  if (range >= 500) return 50;
  if (range >= 200) return 25;
  return 10;
}

/**
 * Construye N buckets contiguos dentro de los bounds dados, redondeados a un
 * step legible (25/50/100/250/500). Devuelve `[]` si los bounds son inválidos
 * o si min === max (no tiene sentido segmentar).
 *
 * Diseño: el primer bucket abre sin `min` (`<X`) y el último cierra sin `max`
 * (`≥Y`) para capturar lo que cae justo en los extremos por redondeo.
 */
export function buildPriceBuckets(
  bounds: { min: number; max: number } | null,
  count: number = 4,
): PriceBucket[] {
  if (!bounds || !Number.isFinite(bounds.min) || !Number.isFinite(bounds.max)) return [];
  if (bounds.max <= bounds.min) return [];

  const span = bounds.max - bounds.min;
  const step = pickStep(span);
  const lo = Math.max(0, roundToStep(bounds.min, step));
  const hi = roundToStep(bounds.max, step);

  if (hi <= lo) return [];

  const segmentSize = Math.max(step, roundToStep((hi - lo) / count, step));
  const edges: number[] = [];
  for (let i = 1; i < count; i++) {
    const edge = lo + segmentSize * i;
    if (edge >= hi) break;
    edges.push(edge);
  }

  const buckets: PriceBucket[] = [];
  buckets.push({ id: `lt-${edges[0] ?? hi}`, min: null, max: edges[0] ?? hi, label: `< ${edges[0] ?? hi}` });
  for (let i = 0; i < edges.length - 1; i++) {
    buckets.push({
      id: `${edges[i]}-${edges[i + 1]}`,
      min: edges[i],
      max: edges[i + 1],
      label: `${edges[i]}–${edges[i + 1]}`,
    });
  }
  if (edges.length > 0) {
    buckets.push({ id: `gte-${edges[edges.length - 1]}`, min: edges[edges.length - 1], max: null, label: `≥ ${edges[edges.length - 1]}` });
  }
  return buckets;
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
  exactPrices?: ExactPricePerNightMap,
): HotelData[] {
  const filteredByMealPlan = filterHotelsByMealPlan(hotels, mealPlan);
  const filtered = filterHotelsByPriceRange(filteredByMealPlan, priceRange, exactPrices);

  // Ordenar por precio mínimo por noche (ascendente) — usa exactPrice cuando hay
  const sorted = [...filtered].sort((a, b) => {
    const priceA = getMinPricePerNight(a, exactPrices);
    const priceB = getMinPricePerNight(b, exactPrices);
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
