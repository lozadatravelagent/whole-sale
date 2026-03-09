import { logTimingStep, nowMs } from '@/utils/debugTiming';
import type { LocalHotelData } from '@/features/chat/types/chat';
import type {
  PlannerInventoryHotelCandidate,
  PlannerPlaceHotelCandidate,
} from '../types';
import { getPlannerHotelDisplayId } from '../utils';

export function rankInventoryHotelsForPlace(input: {
  placeCandidate: PlannerPlaceHotelCandidate;
  hotels: LocalHotelData[];
  linkedSearchId?: string;
}): {
  status: 'matched' | 'needs_confirmation' | 'not_found';
  autoSelectedHotelId?: string;
  candidates: PlannerInventoryHotelCandidate[];
} {
  const t0 = nowMs();

  const candidates: PlannerInventoryHotelCandidate[] = input.hotels.map((hotel) => ({
    hotelId: getPlannerHotelDisplayId(hotel),
    name: hotel.name,
    city: hotel.city,
    linkedSearchId: input.linkedSearchId,
    hotel,
  }));

  if (candidates.length === 0) {
    logTimingStep('hotel-matcher', 'rank', t0, {
      place: input.placeCandidate.name,
      status: 'not_found',
      compared: 0,
    });
    return { status: 'not_found', candidates: [] };
  }

  const result: {
    status: 'matched' | 'needs_confirmation' | 'not_found';
    autoSelectedHotelId?: string;
    candidates: PlannerInventoryHotelCandidate[];
  } = {
    status: candidates.length === 1 ? 'matched' : 'needs_confirmation',
    autoSelectedHotelId: candidates.length === 1 ? candidates[0].hotelId : undefined,
    candidates: candidates.slice(0, 5),
  };

  logTimingStep('hotel-matcher', 'rank', t0, {
    place: input.placeCandidate.name,
    status: result.status,
    compared: input.hotels.length,
  });

  return result;
}
