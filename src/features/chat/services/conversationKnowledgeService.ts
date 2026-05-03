import { supabase } from "@/integrations/supabase/client";
import type { ParsedTravelRequest } from "@/services/aiMessageParser";
import type { ContextState } from "../types/contextState";
import type { PreloadedConversationKnowledge } from "../types/knowledge";

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

  return {
    conversationId: input.conversationId,
    contextualMemory: input.contextualMemory,
    contextState: input.contextState,
    leadId,
  };
}
