import type { Json } from "@/integrations/supabase/types";
import type { ParsedTravelRequest } from "@/services/aiMessageParser";
import type { EmiliaState } from "@/features/chat/state/emiliaState";

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
  leadId: string | null;
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
  plannerContext?: PlannerEditContext | null;
  contextMeta?: {
    conversationId?: string | null;
    leadId?: string | null;
    tenantId?: string | null;
    agencyId?: string | null;
  };
  historyWindow?: number;
  /**
   * Phase 5 (Context Engineering) — pre-rendered state injection block
   * built by `buildMemoryStateBlockFromState`. Forwarded to the
   * `ai-message-parser` edge function which already accepts it (see
   * `supabase/functions/ai-message-parser/prompt.ts` `memoryStateBlock`).
   * Undefined when the feature flag is off.
   */
  memoryStateBlock?: string;
  /**
   * Phase 5 latency optimisation — the EmiliaState that was just saved by
   * `prepareTurnContext`. When present, the edge function uses it directly and
   * skips its own SELECT on `agent_states`, saving ~30–50 ms per turn.
   * The edge function falls back to its own SELECT when this is absent
   * (backward-compatible with old clients / tests that don't send it).
   */
  emiliaState?: EmiliaState;
  /**
   * Per-turn `tool_choice` directive forwarded to OpenAI. Computed by
   * `resolveToolChoice` in `services/toolChoicePolicy.ts` based on planner
   * state, pending action, and discovery guard. When omitted, the edge
   * function defaults to `"auto"` (current behavior).
   */
  toolChoice?: ToolChoice;
}

/**
 * OpenAI `tool_choice` directive. Mirrors the `RunToolLoopArgs.toolChoice`
 * type in `supabase/functions/_shared/toolRunner.ts` (intentional duplication
 * — Deno and the Vite bundler resolve different module trees).
 */
export type ToolChoice =
  | 'auto'
  | 'required'
  | 'none'
  | { type: 'function'; name: string }
  | {
      type: 'allowed_tools';
      mode: 'auto' | 'required';
      tools: Array<{ type: 'function'; name: string }>;
    };

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
