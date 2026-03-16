import type { PlannerPlaceCandidate, PlannerPlaceCategory, TripPlannerState } from './types';
import { formatDestinationLabel } from './utils';
import { isFoodLikePlannerPlace } from './services/plannerPlaceMapper';
import { normalizeLocationLabel } from './helpers';

const REAL_PLACE_PRIORITY: PlannerPlaceCategory[] = ['museum', 'activity', 'restaurant', 'cafe'];
const ICONIC_PLACE_KEYWORD_RE = /\b(museum|museo|temple|templo|shrine|santuario|palace|palacio|tower|torre|park|parque|garden|jardin|cathedral|catedral|market|mercado|castle|castillo|plaza|gallery|galeria|district|barrio|crossing|viewpoint|mirador|mosque|mezquita)\b/i;
const GENERIC_PLACE_KEYWORD_RE = /\b(hotel|airport|aeropuerto|station|estacion|mall|shopping mall|store|shop)\b/i;
export const GENERIC_DAY_TITLE_RE = /\b(llegada|cultura|romance|compras|atardecer|exploracion|exploración|final|ultimo|último|bienvenida|dia libre|día libre|descanso)\b/i;
export const GENERIC_DAY_SUMMARY_RE = /\b(explora|visita|vive|disfruta|relajate|relájate|ambiente|energia|energía|gastronomia|gastronomía|templos|jardines|compras|miradores)\b/i;

export type PlannerRealPlacesBundle = Record<PlannerPlaceCategory, PlannerPlaceCandidate[]>;

export function buildGoogleMapsActivityDescription(place: PlannerPlaceCandidate): string {
  const parts = [place.formattedAddress];
  if (typeof place.rating === 'number') {
    parts.push(`Google ${place.rating.toFixed(1)}`);
  }
  if (place.isOpenNow === true) {
    parts.push('Abierto ahora');
  } else if (place.isOpenNow === false) {
    parts.push('Cerrado ahora');
  }

  return parts.filter(Boolean).join(' \u2022 ');
}

export function hasGoogleMapsContent(day: TripPlannerState['segments'][number]['days'][number]): boolean {
  return (
    day.morning.some((activity) => activity.source === 'google_maps')
    || day.afternoon.some((activity) => activity.source === 'google_maps')
    || day.evening.some((activity) => activity.source === 'google_maps')
    || day.restaurants.some((restaurant) => restaurant.source === 'google_maps')
  );
}

export function scoreRealPlaceCandidate(place: PlannerPlaceCandidate): number {
  const popularityScore = (place.rating || 0) * 18 + Math.log10((place.userRatingsTotal || 0) + 1) * 22;
  const categoryBonus = place.category === 'museum'
    ? 18
    : place.category === 'activity'
      ? 14
      : place.category === 'restaurant'
        ? 12
        : place.category === 'cafe'
          ? 10
          : 4;
  const iconicBonus = ICONIC_PLACE_KEYWORD_RE.test(place.name) ? 18 : 0;
  const genericPenalty = GENERIC_PLACE_KEYWORD_RE.test(place.name) ? 24 : 0;

  return popularityScore + categoryBonus + iconicBonus - genericPenalty;
}

export function dedupeRealPlaceCandidates(candidates: PlannerPlaceCandidate[]): PlannerPlaceCandidate[] {
  const unique = new Map<string, PlannerPlaceCandidate>();

  candidates.forEach((candidate) => {
    const key = `${candidate.placeId}::${normalizeLocationLabel(candidate.name)}`;
    const current = unique.get(key);
    if (!current || scoreRealPlaceCandidate(candidate) > scoreRealPlaceCandidate(current)) {
      unique.set(key, candidate);
    }
  });

  return Array.from(unique.values()).sort((left, right) => scoreRealPlaceCandidate(right) - scoreRealPlaceCandidate(left));
}

export function getRealPlacesCandidatePool(
  placesByCategory: PlannerRealPlacesBundle,
  dayCount: number,
): PlannerPlaceCandidate[] {
  const allCandidates = REAL_PLACE_PRIORITY.flatMap((category) => placesByCategory[category] || []);
  return dedupeRealPlaceCandidates(allCandidates).slice(0, Math.max(12, Math.min(48, dayCount * 6)));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function seededUnit(value: string): number {
  return (hashString(value) % 10000) / 10000;
}

export function buildSegmentRealPlaceSequence(
  segmentSeed: string,
  candidatePool: PlannerPlaceCandidate[],
  dayCount: number,
): PlannerPlaceCandidate[] {
  const limit = Math.max(12, Math.min(candidatePool.length, dayCount * 4 + 6));
  return [...candidatePool]
    .sort((left, right) => {
      const leftScore = scoreRealPlaceCandidate(left) + seededUnit(`${segmentSeed}:${left.placeId}`) * 18;
      const rightScore = scoreRealPlaceCandidate(right) + seededUnit(`${segmentSeed}:${right.placeId}`) * 18;
      return rightScore - leftScore;
    })
    .slice(0, limit);
}

export function pickPlaceForPlannerDay(
  sequence: PlannerPlaceCandidate[],
  usedPlaceIds: Set<string>,
  daySeed: string,
): PlannerPlaceCandidate | null {
  for (const candidate of sequence) {
    if (!usedPlaceIds.has(candidate.placeId)) {
      return candidate;
    }
  }

  if (sequence.length === 0) {
    return null;
  }

  return sequence[hashString(daySeed) % sequence.length];
}

export function getPreferredRealPlaceSlot(
  place: PlannerPlaceCandidate,
  day: TripPlannerState['segments'][number]['days'][number],
  isTransferDay: boolean,
): 'morning' | 'afternoon' | 'evening' | null {
  const primary = place.category === 'museum'
    ? 'morning'
    : place.category === 'cafe'
      ? 'morning'
      : place.category === 'restaurant' || place.activityType === 'food' || place.activityType === 'nightlife' || place.activityType === 'viewpoint'
        ? 'evening'
        : 'afternoon';

  const orderedSlots = isTransferDay && primary === 'morning'
    ? ['afternoon', 'evening', 'morning']
    : [primary, 'morning', 'afternoon', 'evening'].filter((slot, index, array) => array.indexOf(slot) === index);

  for (const slot of orderedSlots) {
    if (day[slot as 'morning' | 'afternoon' | 'evening'].length === 0) {
      return slot as 'morning' | 'afternoon' | 'evening';
    }
  }

  return null;
}

export function shouldPromoteRealPlaceToDayTitle(
  day: TripPlannerState['segments'][number]['days'][number],
): boolean {
  const normalizedTitle = normalizeLocationLabel(day.title || '');
  if (!normalizedTitle) return true;
  return GENERIC_DAY_TITLE_RE.test(normalizedTitle);
}

export function shouldPromoteRealPlaceToDaySummary(
  day: TripPlannerState['segments'][number]['days'][number],
): boolean {
  const normalizedSummary = normalizeLocationLabel(day.summary || '');
  if (!normalizedSummary) return true;
  return GENERIC_DAY_SUMMARY_RE.test(normalizedSummary);
}

export function buildRealPlaceDayTitle(
  place: PlannerPlaceCandidate,
  dayNumber: number,
  segmentCity: string,
): string {
  const options = place.category === 'museum'
    ? [place.name, `Museos en ${place.name}`, `${place.name} y paseo`]
    : place.category === 'restaurant' || place.category === 'cafe'
      ? [`Sabores en ${place.name}`, place.name, `Parada en ${place.name}`]
      : place.activityType === 'viewpoint'
        ? [`Vistas desde ${place.name}`, place.name, `Atardecer en ${place.name}`]
        : [place.name, `Recorrido por ${place.name}`, `${place.name} y alrededores`];

  const seed = hashString(`${segmentCity}:${dayNumber}:${place.placeId}`);
  return options[seed % options.length];
}

export function buildRealPlaceDaySummary(
  place: PlannerPlaceCandidate,
  segmentCity: string,
  dayNumber: number,
): string {
  const cityLabel = formatDestinationLabel(segmentCity);
  const options = place.category === 'museum'
    ? [
        `Visita uno de los puntos culturales mas fuertes de ${cityLabel}.`,
        `Arte, historia y paseo por la zona de ${place.name}.`,
      ]
    : place.category === 'restaurant' || place.category === 'cafe'
      ? [
          `Sabores locales y tiempo para recorrer el entorno de ${place.name}.`,
          `Gastronomia y caminata por una zona con mucho movimiento.`,
        ]
      : place.activityType === 'viewpoint'
        ? [
            `Postales de la ciudad y recorrido por los alrededores.`,
            `Un punto ideal para vistas amplias y paseo cercano.`,
          ]
        : [
            `Recorrido por uno de los lugares mas conocidos de ${cityLabel}.`,
            `Una parada fuerte del destino con tiempo para explorar la zona.`,
          ];

  const seed = hashString(`${segmentCity}:${dayNumber}:summary:${place.placeId}`);
  return options[seed % options.length];
}

export function buildRealPlaceHighlights(
  segmentCity: string,
  sequence: PlannerPlaceCandidate[],
): string[] {
  const used = new Set<string>();
  return sequence
    .filter((place) => {
      const normalized = normalizeLocationLabel(place.name);
      if (!normalized || used.has(normalized)) return false;
      if (isFoodLikePlannerPlace(place) && used.size >= 2) return false;
      used.add(normalized);
      return true;
    })
    .slice(0, 6)
    .map((place) => place.name || formatDestinationLabel(segmentCity));
}

export function pickSlotForRealPlaceInsertion(
  place: PlannerPlaceCandidate,
  day: TripPlannerState['segments'][number]['days'][number],
  isTransferDay: boolean,
): {
  slot: 'morning' | 'afternoon' | 'evening';
  replaceExisting: boolean;
} | null {
  const primary = getPreferredRealPlaceSlot(place, day, isTransferDay);
  const slotOrder = primary
    ? [primary, 'morning', 'afternoon', 'evening'].filter((slot, index, array) => array.indexOf(slot) === index)
    : ['morning', 'afternoon', 'evening'];

  for (const slot of slotOrder) {
    const items = day[slot];
    if (items.length === 0) {
      return { slot, replaceExisting: false };
    }

    const replaceable = items.every((activity) => activity.source !== 'user' && activity.source !== 'google_maps');
    if (replaceable) {
      return { slot, replaceExisting: true };
    }
  }

  return null;
}
