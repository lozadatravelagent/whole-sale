import type { PlannerActivityType, PlannerPlaceCandidate, PlannerPlaceCategory } from '../types';
import { classifyPlannerActivityType, getPlannerPreferredSlot, type PlannerScheduleSlot } from '../scheduling';

function normalizeText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CATEGORY_PRIORITY: PlannerPlaceCategory[] = ['hotel', 'museum', 'restaurant', 'cafe', 'activity'];

function includesType(types: string[] | undefined, candidates: string[]): boolean {
  if (!types || types.length === 0) return false;
  return candidates.some((candidate) => types.includes(candidate));
}

export function inferPlannerPlaceCategory(
  types: string[] | undefined,
  name?: string,
): PlannerPlaceCategory {
  const normalizedName = normalizeText(name);

  if (includesType(types, ['lodging'])) {
    return 'hotel';
  }

  if (includesType(types, ['museum'])) {
    return 'museum';
  }

  if (includesType(types, ['cafe'])) {
    return 'cafe';
  }

  if (includesType(types, ['restaurant', 'meal_takeaway', 'bakery'])) {
    return 'restaurant';
  }

  if (/(museum|museo)/.test(normalizedName)) {
    return 'museum';
  }

  if (/(hotel|resort|suites)/.test(normalizedName)) {
    return 'hotel';
  }

  if (/(cafe|coffee|cafeteria|brunch)/.test(normalizedName)) {
    return 'cafe';
  }

  if (/(restaurant|restaurante|bistro|bar|rooftop|steakhouse|pizzeria|tapas)/.test(normalizedName)) {
    return 'restaurant';
  }

  return 'activity';
}

export function inferPlannerActivityTypeForPlace(
  types: string[] | undefined,
  name?: string,
  category?: PlannerPlaceCategory,
): PlannerActivityType {
  if (category === 'hotel') return 'hotel';
  if (category === 'museum') return 'museum';
  if (category === 'restaurant' || category === 'cafe') return 'food';

  return classifyPlannerActivityType({
    name,
    category: (types || []).join(' '),
  });
}

export function getPlannerPlaceCategoryLabel(category: PlannerPlaceCategory): string {
  switch (category) {
    case 'hotel':
      return 'Hoteles';
    case 'restaurant':
      return 'Restaurantes';
    case 'cafe':
      return 'Cafes';
    case 'museum':
      return 'Museos';
    case 'activity':
    default:
      return 'Que hacer';
  }
}

export function getPlannerPlaceEmoji(category: PlannerPlaceCategory, activityType?: PlannerActivityType): string {
  switch (category) {
    case 'hotel':
      return '🏨';
    case 'restaurant':
      return '🍽️';
    case 'cafe':
      return '☕';
    case 'museum':
      return '🏛️';
    case 'activity':
    default:
      if (activityType === 'shopping') return '🛍️';
      if (activityType === 'nature') return '🌿';
      if (activityType === 'nightlife') return '🌙';
      if (activityType === 'viewpoint') return '👀';
      return '✨';
  }
}

export function buildPlannerPlaceCandidate(input: {
  placeId: string;
  name: string;
  formattedAddress?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrls?: string[];
  types?: string[];
  lat?: number;
  lng?: number;
  website?: string;
  phoneNumber?: string;
  openingHours?: string[];
  isOpenNow?: boolean;
  category?: PlannerPlaceCategory;
}): PlannerPlaceCandidate {
  const category = input.category || inferPlannerPlaceCategory(input.types, input.name);
  const activityType = inferPlannerActivityTypeForPlace(input.types, input.name, category);

  return {
    placeId: input.placeId,
    name: input.name,
    formattedAddress: input.formattedAddress,
    rating: input.rating,
    userRatingsTotal: input.userRatingsTotal,
    photoUrls: input.photoUrls || [],
    types: input.types,
    lat: input.lat,
    lng: input.lng,
    website: input.website,
    phoneNumber: input.phoneNumber,
    openingHours: input.openingHours,
    isOpenNow: input.isOpenNow,
    category,
    activityType,
    source: 'google_maps',
  };
}

export function isFoodLikePlannerPlace(place: Pick<PlannerPlaceCandidate, 'category' | 'activityType'>): boolean {
  return place.category === 'restaurant' || place.category === 'cafe' || place.activityType === 'food';
}

export function getSuggestedSlotForPlannerPlace(
  place: Pick<PlannerPlaceCandidate, 'name' | 'types' | 'category' | 'activityType'>
): PlannerScheduleSlot {
  return getPlannerPreferredSlot({
    name: place.name,
    category: [place.category, ...(place.types || [])].join(' '),
    activityType: place.activityType,
  }, {});
}

export function pickCanonicalPlannerPlaceCategory(categories: PlannerPlaceCategory[]): PlannerPlaceCategory {
  return CATEGORY_PRIORITY.find((category) => categories.includes(category)) || 'activity';
}
