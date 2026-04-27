import { supabase } from "@/integrations/supabase/client";
import type { ParsedTravelRequest } from "@/services/aiMessageParser";
import type { ContextState } from "../types/contextState";
import type { ConversationSummary, LeadAiProfile, PreloadedConversationKnowledge } from "../types/knowledge";
import { loadLeadAiProfile } from "./leadAiProfileService";

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)));
}

function extractResolvedFromParsedRequest(parsedRequest: ParsedTravelRequest): ConversationSummary["resolved"] {
  if (parsedRequest.requestType === "itinerary" && parsedRequest.itinerary) {
    return {
      destinations: uniqueStrings(parsedRequest.itinerary.destinations ?? []),
      startDate: parsedRequest.itinerary.startDate,
      endDate: parsedRequest.itinerary.endDate,
      flexibleMonth: parsedRequest.itinerary.flexibleMonth,
      flexibleYear: parsedRequest.itinerary.flexibleYear,
      days: parsedRequest.itinerary.days,
      adults: parsedRequest.itinerary.travelers?.adults,
      children: parsedRequest.itinerary.travelers?.children,
      infants: parsedRequest.itinerary.travelers?.infants,
      budgetLevel: parsedRequest.itinerary.budgetLevel,
      budgetAmount: parsedRequest.itinerary.budgetAmount,
      pace: parsedRequest.itinerary.pace,
      interests: uniqueStrings(parsedRequest.itinerary.interests ?? []),
      constraints: uniqueStrings(parsedRequest.itinerary.constraints ?? []),
    };
  }

  if (parsedRequest.flights) {
    return {
      origin: parsedRequest.flights.origin,
      destinations: uniqueStrings([parsedRequest.flights.destination]),
      startDate: parsedRequest.flights.departureDate,
      endDate: parsedRequest.flights.returnDate,
      adults: parsedRequest.flights.adults,
      children: parsedRequest.flights.children,
      infants: parsedRequest.flights.infants,
    };
  }

  if (parsedRequest.hotels) {
    return {
      destinations: uniqueStrings([parsedRequest.hotels.city]),
      startDate: parsedRequest.hotels.checkinDate,
      endDate: parsedRequest.hotels.checkoutDate,
      adults: parsedRequest.hotels.adults,
      children: parsedRequest.hotels.children,
      infants: parsedRequest.hotels.infants,
    };
  }

  return {};
}

export function buildConversationSummary(
  parsedRequest: ParsedTravelRequest,
  userMessage: string,
  existingSummary?: ConversationSummary | null,
): ConversationSummary {
  return {
    schemaVersion: 1,
    requestType: parsedRequest.requestType ?? "unknown",
    lastUserGoal: userMessage.trim(),
    resolved: {
      ...(existingSummary?.resolved ?? {}),
      ...extractResolvedFromParsedRequest(parsedRequest),
    },
    unresolvedFields: uniqueStrings([
      ...(parsedRequest.missingFields ?? []),
      ...(parsedRequest.missingRequiredFields ?? []),
    ]),
    turnCount: Math.max(1, (existingSummary?.turnCount ?? 0) + 1),
    updatedAt: new Date().toISOString(),
  };
}

export async function loadConversationSummary(conversationId: string): Promise<ConversationSummary | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("meta")
    .eq("conversation_id", conversationId)
    .eq("role", "system")
    .contains("meta", { messageType: "conversation_summary" })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[CONVERSATION_SUMMARY] load failed:", error);
    return null;
  }

  const summary = data?.[0]?.meta && typeof data[0].meta === "object"
    ? (data[0].meta as Record<string, unknown>).conversationSummary
    : null;

  return summary as ConversationSummary | null;
}

export async function saveConversationSummary(conversationId: string, summary: ConversationSummary): Promise<void> {
  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("role", "system")
    .contains("meta", { messageType: "conversation_summary" });

  if (deleteError) {
    console.warn("[CONVERSATION_SUMMARY] failed deleting old summary:", deleteError);
  }

  const { error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "system",
      content: { text: "" },
      meta: {
        messageType: "conversation_summary",
        conversationSummary: summary,
        timestamp: new Date().toISOString(),
      },
    });

  if (error) {
    console.error("[CONVERSATION_SUMMARY] save failed:", error);
  }
}

export async function resolveLeadIdForConversation(conversationId: string): Promise<string | null> {
  const { data: tripRow, error: tripError } = await supabase
    .from("trips")
    .select("lead_id")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (!tripError && tripRow?.lead_id) {
    return tripRow.lead_id;
  }

  const { data: leadRow, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leadError) {
    console.error("[CONVERSATION_KNOWLEDGE] resolve lead failed:", leadError);
    return null;
  }

  return leadRow?.id ?? null;
}

export async function preloadConversationKnowledge(input: {
  conversationId: string;
  contextualMemory: ParsedTravelRequest | null;
  contextState: ContextState | null;
}): Promise<PreloadedConversationKnowledge> {
  const leadId = await resolveLeadIdForConversation(input.conversationId);
  const [conversationSummary, leadProfile] = await Promise.all([
    loadConversationSummary(input.conversationId),
    leadId ? loadLeadAiProfile(leadId) : Promise.resolve<LeadAiProfile | null>(null),
  ]);

  return {
    conversationId: input.conversationId,
    contextualMemory: input.contextualMemory,
    contextState: input.contextState,
    conversationSummary,
    leadId,
    leadProfile,
  };
}
