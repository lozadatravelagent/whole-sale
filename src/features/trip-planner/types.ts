import type { FlightData, LocalHotelData } from '@/features/chat/types/chat';

export type PlannerBudgetLevel = 'low' | 'mid' | 'high' | 'luxury';
export type PlannerPace = 'relaxed' | 'balanced' | 'fast';
export type PlannerActivityType =
  | 'museum'
  | 'landmark'
  | 'walk'
  | 'food'
  | 'market'
  | 'nightlife'
  | 'shopping'
  | 'nature'
  | 'family'
  | 'wellness'
  | 'transport'
  | 'hotel'
  | 'viewpoint'
  | 'culture'
  | 'experience'
  | 'unknown';
export type PlannerSchedulingConfidence = 'high' | 'medium' | 'low';

export interface PlannerActivity {
  id: string;
  time?: string;
  title: string;
  description?: string;
  tip?: string;
  category?: string;
  activityType?: PlannerActivityType;
  recommendedSlot?: 'morning' | 'afternoon' | 'evening';
  durationMinutes?: number;
  schedulingConfidence?: PlannerSchedulingConfidence;
  neighborhood?: string;
  locked?: boolean;
  source?: 'generated' | 'user';
}

export interface PlannerRestaurant {
  id: string;
  name: string;
  type?: string;
  priceRange?: string;
}

export interface PlannerLocation {
  city: string;
  country?: string;
  lat: number;
  lng: number;
  placeLabel?: string;
  source?: 'provider' | 'fallback';
}

export interface PlannerDay {
  id: string;
  dayNumber: number;
  date?: string;
  city: string;
  title: string;
  summary?: string;
  locked?: boolean;
  morning: PlannerActivity[];
  afternoon: PlannerActivity[];
  evening: PlannerActivity[];
  restaurants: PlannerRestaurant[];
  travelTip?: string;
}

export interface SegmentHotelPlan {
  city: string;
  checkinDate?: string;
  checkoutDate?: string;
  requestedStars?: number;
  requestedMealPlan?: string;
  searchStatus: 'idle' | 'loading' | 'ready' | 'error';
  selectedHotelId?: string;
  hotelRecommendations: LocalHotelData[];
  linkedSearchId?: string;
  lastSearchSignature?: string;
  error?: string;
}

export interface PlannerTransport {
  type: 'flight' | 'train' | 'transfer' | 'car' | 'ferry' | 'manual';
  summary: string;
  origin?: string;
  destination?: string;
  date?: string;
  searchStatus?: 'idle' | 'loading' | 'ready' | 'error';
  linkedSearchId?: string;
  selectedOptionId?: string;
  lastSearchSignature?: string;
  options?: FlightData[];
  error?: string;
}

export interface PlannerSegment {
  id: string;
  city: string;
  country?: string;
  location?: PlannerLocation;
  startDate?: string;
  endDate?: string;
  nights?: number;
  order: number;
  summary?: string;
  hotelPlan: SegmentHotelPlan;
  transportIn?: PlannerTransport | null;
  transportOut?: PlannerTransport | null;
  days: PlannerDay[];
}

export interface TripPlannerState {
  id: string;
  conversationId?: string;
  title: string;
  summary: string;
  startDate?: string;
  endDate?: string;
  isFlexibleDates?: boolean;
  flexibleMonth?: string;
  flexibleYear?: number;
  days: number;
  budgetLevel?: PlannerBudgetLevel;
  budgetAmount?: number;
  pace?: PlannerPace;
  travelers: {
    adults: number;
    children: number;
    infants: number;
  };
  interests: string[];
  constraints: string[];
  destinations: string[];
  segments: PlannerSegment[];
  notes?: string[];
  generalTips: string[];
  generationMeta: {
    source: 'chat' | 'ui_edit' | 'regen_day' | 'regen_segment' | 'regen_plan' | 'system';
    updatedAt: string;
    version: number;
  };
}
