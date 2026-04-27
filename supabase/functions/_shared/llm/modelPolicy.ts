export type LlmFeature =
  | "ai-message-parser"
  | "travel-itinerary";

export type LlmOperation =
  | "parse"
  | "generate"
  | "repair";

export interface ResolveModelPolicyInput {
  feature: LlmFeature;
  operation: LlmOperation;
  generationMode?: "skeleton" | "segment" | "full" | null;
}

export interface ModelPolicyDecision {
  provider: "openai";
  model: string;
}

export function resolveModelPolicy(input: ResolveModelPolicyInput): ModelPolicyDecision {
  if (input.feature === "ai-message-parser") {
    return { provider: "openai", model: "gpt-5-mini" };
  }

  if (input.operation === "repair") {
    return { provider: "openai", model: "gpt-5-nano" };
  }

  if (input.feature === "travel-itinerary") {
    if (input.generationMode === "skeleton") {
      return { provider: "openai", model: "gpt-5-mini" };
    }

    return { provider: "openai", model: "gpt-4.1" };
  }

  return { provider: "openai", model: "gpt-4.1" };
}
