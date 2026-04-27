import type { Json } from "@/integrations/supabase/types";
import type { ParsedTravelRequest } from "@/services/aiMessageParser";

export interface ConversationSummaryResolved {
  origin?: string;
  destinations?: string[];
  startDate?: string;
  endDate?: string;
  flexibleMonth?: string;
  flexibleYear?: number;
  days?: number;
  adults?: number;
  children?: number;
  infants?: number;
  budgetLevel?: string;
  budgetAmount?: number;
  pace?: string;
  interests?: string[];
  constraints?: string[];
}

export interface ConversationSummary {
  schemaVersion: number;
  requestType: ParsedTravelRequest["requestType"] | "unknown";
  lastUserGoal: string;
  resolved: ConversationSummaryResolved;
  unresolvedFields: string[];
  turnCount: number;
  updatedAt: string;
}

export interface LeadAiProfile {
  id?: string;
  leadId: string;
  tenantId?: string | null;
  agencyId?: string | null;
  sourceConversationId?: string | null;
  schemaVersion: number;
  profile: {
    homeAirport?: string;
    travelerDefaults?: {
      adults?: number;
      children?: number;
      infants?: number;
    };
    budgetBand?: string;
    hotelTier?: string;
    pace?: string;
    interests?: string[];
    constraints?: string[];
    recentDestinations?: string[];
    lastConfirmedDates?: {
      startDate?: string;
      endDate?: string;
      flexibleMonth?: string;
      flexibleYear?: number;
    };
    preferredTripStyle?: string[];
  };
  summaryText?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PreloadedConversationKnowledge {
  conversationId: string;
  contextualMemory: ParsedTravelRequest | null;
  contextState: any | null;
  conversationSummary: ConversationSummary | null;
  leadId: string | null;
  leadProfile: LeadAiProfile | null;
}

export interface PlannerEditContext {
  hasActivePlan: boolean;
  title?: string;
  summary?: string;
  destinations?: string[];
  days?: number;
  startDate?: string;
  endDate?: string;
  isFlexibleDates?: boolean;
  flexibleMonth?: string;
  flexibleYear?: number;
  budgetLevel?: string;
  budgetAmount?: number;
  pace?: string;
  travelers?: {
    adults?: number;
    children?: number;
    infants?: number;
  };
  interests?: string[];
  constraints?: string[];
  segments?: Array<{
    id?: string;
    city?: string;
    country?: string;
    order?: number;
    nights?: number;
    dayCount?: number;
    startDate?: string;
    endDate?: string;
    hotelStatus?: string;
    transportIn?: string;
    transportOut?: string;
    days?: Array<{
      id?: string;
      dayNumber?: number;
      title?: string;
    }>;
  }>;
}

export interface ParseMessageKnowledge {
  conversationSummary?: ConversationSummary | null;
  leadProfile?: LeadAiProfile | null;
  plannerContext?: PlannerEditContext | null;
  contextMeta?: {
    conversationId?: string | null;
    leadId?: string | null;
    tenantId?: string | null;
    agencyId?: string | null;
  };
  historyWindow?: number;
}

export interface LlmUsage {
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedTokens?: number | null;
  estimatedCostUsd: number;
  finishReason?: string | null;
}

export type LeadAiProfileRowJson = Json;
