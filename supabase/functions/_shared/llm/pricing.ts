const MODEL_PRICING_USD_PER_MILLION: Record<string, { input: number; output: number; cachedInput?: number }> = {
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2.0 },
  "gpt-5-nano": { input: 0.05, cachedInput: 0.005, output: 0.4 },
  "gpt-4.1": { input: 2.0, cachedInput: 0.5, output: 8.0 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
};

// OpenAI responses carry dated model ids (e.g. "gpt-4.1-mini-2025-04-14");
// strip the date suffix so the lookup matches the base entry above.
function normalizeModelName(model: string): string {
  return model.replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

export interface EstimateCostInput {
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  cachedTokens?: number | null;
}

export function estimateCostUsd(input: EstimateCostInput): number {
  const pricing = MODEL_PRICING_USD_PER_MILLION[normalizeModelName(input.model)];
  if (!pricing) return 0;

  const promptTokens = Math.max(0, input.promptTokens ?? 0);
  const completionTokens = Math.max(0, input.completionTokens ?? 0);
  const cachedTokens = Math.max(0, input.cachedTokens ?? 0);
  const nonCachedPromptTokens = Math.max(0, promptTokens - cachedTokens);

  const promptCost = (nonCachedPromptTokens / 1_000_000) * pricing.input;
  const cachedPromptCost = (cachedTokens / 1_000_000) * (pricing.cachedInput ?? pricing.input);
  const completionCost = (completionTokens / 1_000_000) * pricing.output;

  return Number((promptCost + cachedPromptCost + completionCost).toFixed(6));
}
