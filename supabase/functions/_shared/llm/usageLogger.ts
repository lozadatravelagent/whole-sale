import { estimateCostUsd } from "./pricing.ts";

export interface LlmContextMeta {
  conversationId?: string | null;
  leadId?: string | null;
  tenantId?: string | null;
  agencyId?: string | null;
}

export interface LlmUsageMetrics {
  promptTokens?: number | null;
  completionTokens?: number | null;
  cachedTokens?: number | null;
  totalTokens?: number | null;
}

export interface LogLlmRequestInput {
  provider: string;
  model: string;
  feature: string;
  operation: string;
  requestId?: string | null;
  success: boolean;
  latencyMs?: number | null;
  finishReason?: string | null;
  usage?: LlmUsageMetrics | null;
  contextMeta?: LlmContextMeta | null;
  metadata?: Record<string, unknown>;
}

interface ResolvedContextMeta {
  conversationId: string | null;
  leadId: string | null;
  tenantId: string | null;
  agencyId: string | null;
}

async function resolveContextMeta(supabase: any, contextMeta?: LlmContextMeta | null): Promise<ResolvedContextMeta> {
  const resolved: ResolvedContextMeta = {
    conversationId: contextMeta?.conversationId ?? null,
    leadId: contextMeta?.leadId ?? null,
    tenantId: contextMeta?.tenantId ?? null,
    agencyId: contextMeta?.agencyId ?? null,
  };

  if (resolved.conversationId && (!resolved.tenantId || !resolved.agencyId)) {
    const { data } = await supabase
      .from("conversations")
      .select("tenant_id, agency_id")
      .eq("id", resolved.conversationId)
      .maybeSingle();

    if (data) {
      resolved.tenantId = resolved.tenantId ?? data.tenant_id ?? null;
      resolved.agencyId = resolved.agencyId ?? data.agency_id ?? null;
    }
  }

  if (resolved.leadId && (!resolved.tenantId || !resolved.agencyId || !resolved.conversationId)) {
    const { data } = await supabase
      .from("leads")
      .select("tenant_id, agency_id, conversation_id")
      .eq("id", resolved.leadId)
      .maybeSingle();

    if (data) {
      resolved.tenantId = resolved.tenantId ?? data.tenant_id ?? null;
      resolved.agencyId = resolved.agencyId ?? data.agency_id ?? null;
      resolved.conversationId = resolved.conversationId ?? data.conversation_id ?? null;
    }
  }

  if (!resolved.leadId && resolved.conversationId) {
    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("conversation_id", resolved.conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      resolved.leadId = data.id;
    }
  }

  return resolved;
}

export async function logLlmRequest(supabase: any, input: LogLlmRequestInput): Promise<void> {
  try {
    const usage = input.usage ?? {};
    const context = await resolveContextMeta(supabase, input.contextMeta);
    const estimatedCostUsd = estimateCostUsd({
      model: input.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      cachedTokens: usage.cachedTokens,
    });

    const { error } = await supabase.from("llm_request_logs").insert({
      tenant_id: context.tenantId,
      agency_id: context.agencyId,
      conversation_id: context.conversationId,
      lead_id: context.leadId,
      provider: input.provider,
      model: input.model,
      feature: input.feature,
      operation: input.operation,
      request_id: input.requestId ?? null,
      prompt_tokens: usage.promptTokens ?? null,
      completion_tokens: usage.completionTokens ?? null,
      cached_tokens: usage.cachedTokens ?? null,
      total_tokens: usage.totalTokens ?? null,
      estimated_cost_usd: estimatedCostUsd,
      latency_ms: input.latencyMs ?? null,
      finish_reason: input.finishReason ?? null,
      success: input.success,
      metadata: input.metadata ?? {},
    });

    if (error) {
      console.warn("[LLM_USAGE] Failed to insert llm_request_logs row:", error.message);
    }
  } catch (error) {
    console.warn("[LLM_USAGE] Unexpected error while logging usage:", error);
  }
}
