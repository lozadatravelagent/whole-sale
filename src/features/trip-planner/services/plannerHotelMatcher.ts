import type { LocalHotelData } from '@/features/chat/types/chat';
import type {
  PlannerInventoryHotelCandidate,
  PlannerPlaceHotelCandidate,
} from '../types';
import { getPlannerHotelDisplayId } from '../utils';

const GENERIC_NAME_TOKENS = new Set([
  'hotel',
  'hotels',
  'resort',
  'resorts',
  'spa',
  'the',
  'by',
  'and',
  'y',
  'de',
  'del',
  'la',
  'el',
  'a',
  'an',
  '&',
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

function tokenize(value: string, removeGeneric = false): string[] {
  const tokens = normalizeText(value)
    .split(' ')
    .filter(Boolean);

  if (!removeGeneric) {
    return tokens;
  }

  return tokens.filter((token) => !GENERIC_NAME_TOKENS.has(token));
}

function buildBigrams(value: string): Set<string> {
  const compact = normalizeText(value).replace(/\s+/g, ' ');
  const result = new Set<string>();

  for (let index = 0; index < compact.length - 1; index += 1) {
    result.add(compact.slice(index, index + 2));
  }

  return result;
}

function diceCoefficient(left: string, right: string): number {
  const leftBigrams = buildBigrams(left);
  const rightBigrams = buildBigrams(right);

  if (leftBigrams.size === 0 || rightBigrams.size === 0) {
    return 0;
  }

  let overlap = 0;
  leftBigrams.forEach((bigram) => {
    if (rightBigrams.has(bigram)) {
      overlap += 1;
    }
  });

  return (2 * overlap) / (leftBigrams.size + rightBigrams.size);
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  });

  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function calculateHotelMatchScore(placeName: string, hotelName: string): {
  score: number;
  reasons: string[];
} {
  const normalizedPlace = normalizeText(placeName);
  const normalizedHotel = normalizeText(hotelName);
  const allPlaceTokens = tokenize(placeName);
  const allHotelTokens = tokenize(hotelName);
  const importantPlaceTokens = tokenize(placeName, true);
  const importantHotelTokens = tokenize(hotelName, true);
  const dice = diceCoefficient(placeName, hotelName);
  const tokenScore = jaccard(allPlaceTokens, allHotelTokens);
  const importantScore = jaccard(importantPlaceTokens, importantHotelTokens);
  const exactMatch = normalizedPlace === normalizedHotel;
  const containmentMatch =
    normalizedPlace.includes(normalizedHotel) || normalizedHotel.includes(normalizedPlace);
  const leadingTokenMatch =
    importantPlaceTokens.length > 0 &&
    importantHotelTokens.length > 0 &&
    importantPlaceTokens[0] === importantHotelTokens[0];

  let score = 0;
  score += dice * 0.45;
  score += tokenScore * 0.25;
  score += importantScore * 0.2;

  if (exactMatch) score += 0.25;
  if (containmentMatch) score += 0.12;
  if (leadingTokenMatch) score += 0.06;

  score = Math.min(1, Number(score.toFixed(4)));

  const reasons: string[] = [];
  if (exactMatch) {
    reasons.push('Nombre exacto');
  } else if (containmentMatch) {
    reasons.push('Nombre muy parecido');
  }
  if (importantScore >= 0.5) {
    reasons.push('Coinciden tokens principales');
  }
  if (leadingTokenMatch) {
    reasons.push('Misma marca o cadena inicial');
  }
  if (reasons.length === 0 && score > 0.55) {
    reasons.push('Coincidencia parcial razonable');
  }

  return { score, reasons };
}

export function rankInventoryHotelsForPlace(input: {
  placeCandidate: PlannerPlaceHotelCandidate;
  hotels: LocalHotelData[];
  linkedSearchId?: string;
}): {
  status: 'matched' | 'needs_confirmation' | 'not_found';
  autoSelectedHotelId?: string;
  candidates: PlannerInventoryHotelCandidate[];
} {
  const candidates = input.hotels
    .map((hotel) => {
      const { score, reasons } = calculateHotelMatchScore(input.placeCandidate.name, hotel.name);
      return {
        hotelId: getPlannerHotelDisplayId(hotel),
        name: hotel.name,
        city: hotel.city,
        score,
        reasons,
        linkedSearchId: input.linkedSearchId,
        hotel,
      } satisfies PlannerInventoryHotelCandidate;
    })
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) {
    return {
      status: 'not_found',
      candidates: [],
    };
  }

  const topCandidate = candidates[0];
  const secondCandidate = candidates[1];
  const scoreGap = topCandidate.score - (secondCandidate?.score || 0);

  if (
    topCandidate.score >= 0.88 &&
    (scoreGap >= 0.08 || !secondCandidate || secondCandidate.score < 0.75)
  ) {
    return {
      status: 'matched',
      autoSelectedHotelId: topCandidate.hotelId,
      candidates: candidates.slice(0, 5),
    };
  }

  if (topCandidate.score >= 0.62) {
    return {
      status: 'needs_confirmation',
      candidates: candidates.slice(0, 5),
    };
  }

  return {
    status: 'not_found',
    candidates: candidates.slice(0, 5),
  };
}
